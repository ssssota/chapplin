import {
	AppBridge,
	buildAllowAttribute,
	getToolUiResourceUri,
	type McpUiHostCapabilities,
	type McpUiHostContext,
	type McpUiResourceMeta,
	PostMessageTransport,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
	type CallToolResult,
	CallToolResultSchema,
	type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { connectDevMcp, getToolByName } from "./client.js";

type ToolInput = Record<string, unknown>;

export interface PreviewHostBridge {
	executeTool: (arguments_: ToolInput) => Promise<CallToolResult>;
	dispose: () => Promise<void>;
}

interface CreatePreviewHostBridgeOptions {
	iframe: HTMLIFrameElement;
	toolName: string;
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

function createInitialHostContext(tool: Tool): McpUiHostContext {
	const prefersDark = window.matchMedia?.(
		"(prefers-color-scheme: dark)",
	).matches;

	return {
		toolInfo: { tool },
		theme: prefersDark ? "dark" : "light",
		displayMode: "inline",
		availableDisplayModes: ["inline"],
		platform: "web",
		locale: navigator.language,
		timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		userAgent: navigator.userAgent,
	};
}

function extractUiMeta(metaSource: unknown): McpUiResourceMeta | undefined {
	const meta = metaSource;
	if (!meta || typeof meta !== "object") return undefined;

	const ui = (meta as Record<string, unknown>).ui;
	if (!ui || typeof ui !== "object") return undefined;

	return ui as McpUiResourceMeta;
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
	toolName,
}: CreatePreviewHostBridgeOptions): Promise<PreviewHostBridge> {
	const iframeWindow = iframe.contentWindow;
	if (!iframeWindow) {
		throw new Error("Failed to access iframe window");
	}

	const mcp = await connectDevMcp();
	const tool = await getToolByName(mcp.client, toolName);
	await applyIframePermissionsFromResourceMeta(iframe, mcp.client, tool);

	const bridge = new AppBridge(
		mcp.client,
		HOST_INFO,
		createHostCapabilities(),
		{ hostContext: createInitialHostContext(tool) },
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

	bridge.onmessage = async () => ({});
	bridge.onupdatemodelcontext = async () => ({});

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
						name: toolName,
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
