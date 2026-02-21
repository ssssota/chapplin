import {
	AppBridge,
	buildAllowAttribute,
	getToolUiResourceUri,
	type McpUiHostCapabilities,
	type McpUiHostContext,
	type McpUiHostContextChangedNotification,
	type McpUiMessageRequest,
	type McpUiResourceMeta,
	type McpUiTheme,
	PostMessageTransport,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
	type CallToolResult,
	CallToolResultSchema,
	ListToolsResultSchema,
	type LoggingMessageNotification,
	type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { connectDevMcp } from "./client.js";

type ToolInput = Record<string, unknown>;

export interface PreviewHostEvent {
	kind: "message" | "log";
	timestamp: number;
	payload: McpUiMessageRequest["params"] | LoggingMessageNotification["params"];
}

export interface PreviewHostBridge {
	executeTool: (arguments_: ToolInput) => Promise<CallToolResult>;
	sendHostContextChange: (
		context: McpUiHostContextChangedNotification["params"],
	) => Promise<void>;
	dispose: () => Promise<void>;
}

interface CreatePreviewHostBridgeOptions {
	iframe: HTMLIFrameElement;
	tool: Tool;
	hostContext?: McpUiHostContext;
	onEvent?: (event: PreviewHostEvent) => void;
}

const HOST_INFO = {
	name: "chapplin-dev-ui",
	version: "0.1.0",
} as const;

function createHostCapabilities(): McpUiHostCapabilities {
	return {
		openLinks: {},
		serverTools: { listChanged: true },
		serverResources: { listChanged: true },
		logging: {},
		message: {},
		updateModelContext: {},
	};
}

function createInitialHostContext(
	tool: Tool,
	hostContext?: McpUiHostContext,
): McpUiHostContext {
	const prefersDark = window.matchMedia?.(
		"(prefers-color-scheme: dark)",
	).matches;

	const theme = hostContext?.theme ?? (prefersDark ? "dark" : "light");
	const fallbackTheme: McpUiTheme = theme === "dark" ? "dark" : "light";

	return {
		displayMode: "inline",
		availableDisplayModes: ["inline"],
		platform: "web",
		locale: navigator.language,
		timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		userAgent: navigator.userAgent,
		...hostContext,
		toolInfo: {
			...hostContext?.toolInfo,
			tool,
		},
		theme: fallbackTheme,
	};
}

function extractUiMeta(metaSource: unknown): McpUiResourceMeta | undefined {
	const meta = metaSource;
	if (!meta || typeof meta !== "object") return undefined;

	const ui = (meta as Record<string, unknown>).ui;
	if (!ui || typeof ui !== "object") return undefined;

	return ui as McpUiResourceMeta;
}

function getToolVisibility(tool: Tool): Array<"model" | "app"> | undefined {
	const meta = tool._meta;
	if (!meta || typeof meta !== "object") return undefined;
	const ui = (meta as Record<string, unknown>).ui;
	if (!ui || typeof ui !== "object") return undefined;
	const visibility = (ui as Record<string, unknown>).visibility;
	if (!Array.isArray(visibility)) return undefined;
	return visibility.filter(
		(value): value is "model" | "app" => value === "model" || value === "app",
	);
}

function isAppVisibleTool(tool: Tool): boolean {
	const visibility = getToolVisibility(tool);
	if (!visibility || visibility.length === 0) return true;
	return visibility.includes("app");
}

function createToolAccessDeniedResult(toolName: string): CallToolResult {
	return {
		isError: true,
		content: [
			{
				type: "text",
				text: `Tool '${toolName}' is not callable from MCP Apps.`,
			},
		],
	};
}

async function applyIframePermissionsFromResourceMeta(
	iframe: HTMLIFrameElement,
	client: Client,
	tool: Tool,
): Promise<void> {
	const resourceUri = getToolUiResourceUri(tool);
	if (!resourceUri) {
		iframe.removeAttribute("allow");
		return;
	}

	const { resources } = await client.listResources();
	const resource = resources.find((candidate) => candidate.uri === resourceUri);
	const appMeta = extractUiMeta(resource?._meta);
	const allow = buildAllowAttribute(appMeta?.permissions);

	if (allow) {
		iframe.setAttribute("allow", allow);
	} else {
		iframe.removeAttribute("allow");
	}
}

type CallToolResponse = Awaited<ReturnType<Client["callTool"]>>;

function normalizeCallToolResult(result: CallToolResponse): CallToolResult {
	const parsed = CallToolResultSchema.safeParse(result);
	if (parsed.success) {
		return parsed.data;
	}

	const fallbackText = JSON.stringify(result.toolResult);
	return {
		content: [{ type: "text", text: fallbackText }],
		_meta: result._meta,
		structuredContent:
			result.toolResult && typeof result.toolResult === "object"
				? (result.toolResult as Record<string, unknown>)
				: undefined,
	};
}

export async function createPreviewHostBridge({
	iframe,
	tool,
	hostContext,
	onEvent,
}: CreatePreviewHostBridgeOptions): Promise<PreviewHostBridge> {
	const iframeWindow = iframe.contentWindow;
	if (!iframeWindow) {
		throw new Error("Failed to access iframe window");
	}

	const mcp = await connectDevMcp();
	await applyIframePermissionsFromResourceMeta(iframe, mcp.client, tool);

	const bridge = new AppBridge(
		mcp.client,
		HOST_INFO,
		createHostCapabilities(),
		{ hostContext: createInitialHostContext(tool, hostContext) },
	);
	const transport = new PostMessageTransport(iframeWindow, iframeWindow);
	let disposed = false;
	let initialized = false;
	let resolveInitialized: (() => void) | null = null;
	const initializedPromise = new Promise<void>((resolve) => {
		resolveInitialized = resolve;
	});

	bridge.oninitialized = () => {
		initialized = true;
		resolveInitialized?.();
	};

	bridge.onsizechange = ({ height }) => {
		if (typeof height === "number" && Number.isFinite(height)) {
			iframe.style.height = `${Math.max(240, Math.ceil(height))}px`;
		}
	};

	bridge.onopenlink = async ({ url }) => {
		try {
			window.open(url, "_blank", "noopener,noreferrer");
			return {};
		} catch {
			return { isError: true };
		}
	};

	bridge.onmessage = async (params) => {
		onEvent?.({
			kind: "message",
			timestamp: Date.now(),
			payload: params,
		});
		return {};
	};
	bridge.onloggingmessage = (params) => {
		onEvent?.({
			kind: "log",
			timestamp: Date.now(),
			payload: params,
		});
	};
	bridge.onupdatemodelcontext = async () => ({});
	bridge.oncalltool = async (params, extra) => {
		const listed = await mcp.client.request(
			{ method: "tools/list" },
			ListToolsResultSchema,
			{ signal: extra.signal },
		);
		const requestedTool = listed.tools.find(
			(candidate) => candidate.name === params.name,
		);
		if (!requestedTool || !isAppVisibleTool(requestedTool)) {
			return createToolAccessDeniedResult(params.name);
		}
		return mcp.client.request(
			{ method: "tools/call", params },
			CallToolResultSchema,
			{ signal: extra.signal },
		);
	};
	await bridge.connect(transport);

	const waitForInitialized = async (): Promise<void> => {
		if (initialized) return;
		await initializedPromise;
	};

	return {
		executeTool: async (arguments_) => {
			if (disposed) {
				throw new Error("Host bridge is already disposed");
			}

			await waitForInitialized();
			await bridge.sendToolInput({ arguments: arguments_ });

			try {
				const response = await mcp.client.callTool(
					{
						name: tool.name,
						arguments: arguments_,
					},
					CallToolResultSchema,
				);
				const result = normalizeCallToolResult(response);
				await bridge.sendToolResult(result);
				return result;
			} catch (error) {
				await bridge.sendToolCancelled({
					reason: error instanceof Error ? error.message : "Unknown error",
				});
				throw error;
			}
		},
		sendHostContextChange: async (context) => {
			if (disposed) {
				throw new Error("Host bridge is already disposed");
			}

			await waitForInitialized();
			await bridge.sendHostContextChange(context);
		},
		dispose: async () => {
			if (disposed) return;
			disposed = true;
			await Promise.allSettled([
				bridge.teardownResource({}),
				bridge.close(),
				transport.close(),
				mcp.close(),
			]);
		},
	};
}
