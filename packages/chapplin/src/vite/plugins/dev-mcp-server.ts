import { readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join } from "node:path";
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps";
import {
	McpServer,
	type ResourceMetadata,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { ViteDevServer } from "vite";
import { createAppHtml, createDevAppEntrySrc } from "./app-entry.js";
import {
	createDevIframePathFromToolPath,
	createDevToolUiResourceUri,
} from "./dev-app-path.js";
import { getCollectedFiles } from "./file-collector.js";

const MCP_PATH = "/mcp";

export interface DevMcpServerInfo {
	name: string;
	version: string;
}

export function getDevMcpServerInfo(root: string): DevMcpServerInfo {
	try {
		const packageJsonPath = join(root, "package.json");
		const packageJson = JSON.parse(
			readFileSync(packageJsonPath, "utf-8"),
		) as Partial<{
			name: string;
			version: string;
		}>;
		return {
			name: packageJson.name ?? "chapplin-dev-server",
			version: packageJson.version ?? "0.0.0-dev",
		};
	} catch {
		return { name: "chapplin-dev-server", version: "0.0.0-dev" };
	}
}

function isMcpPath(url: string): boolean {
	return url === MCP_PATH || url.startsWith(`${MCP_PATH}?`);
}

function hasRequestBody(req: IncomingMessage): boolean {
	const method = req.method?.toUpperCase();
	return method === "POST" || method === "PUT" || method === "PATCH";
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
	if (!hasRequestBody(req)) return undefined;

	const chunks: Buffer[] = [];
	for await (const chunk of req) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	const raw = Buffer.concat(chunks).toString("utf-8").trim();
	if (!raw) return undefined;
	return JSON.parse(raw);
}

type UnknownRecord = Record<string, unknown>;

interface ToolDefinition {
	name: string;
	config: UnknownRecord & { description?: string; _meta?: unknown };
	// biome-ignore lint/suspicious/noExplicitAny: allow any for handler
	handler: (...args: any[]) => any;
}

interface AppDefinition {
	meta?: UnknownRecord;
}

interface ResourceDefinition {
	name: string;
	config: { uri: string } & UnknownRecord;
	// biome-ignore lint/suspicious/noExplicitAny: allow any for handler
	handler: (...args: any[]) => any;
}

interface PromptDefinition {
	name: string;
	config: UnknownRecord;
	// biome-ignore lint/suspicious/noExplicitAny: allow any for handler
	handler: (...args: any[]) => any;
}

function readExport<T>(
	module: UnknownRecord,
	exportName: string,
	filePath: string,
): T {
	const value = module[exportName];
	if (value === undefined) {
		throw new Error(`Missing exported '${exportName}' in ${filePath}`);
	}
	return value as T;
}

function getToolPathFromCollectedFile(
	toolPathWithoutExt: string,
	file: string,
): string {
	return `${toolPathWithoutExt}${extname(file)}`;
}

async function registerCollectedModules(
	mcp: McpServer,
	viteServer: ViteDevServer,
): Promise<void> {
	const files = await getCollectedFiles();

	for (const toolFile of files.tools) {
		const imported: UnknownRecord = await viteServer.ssrLoadModule(
			toolFile.path,
		);
		const tool = readExport<ToolDefinition>(imported, "tool", toolFile.path);

		if (toolFile.hasApp) {
			const app = readExport<AppDefinition>(imported, "app", toolFile.path);
			const toolPath = getToolPathFromCollectedFile(
				toolFile.name,
				toolFile.path,
			);
			const uri = createDevToolUiResourceUri(toolPath);
			const html = await viteServer.transformIndexHtml(
				createDevIframePathFromToolPath(toolPath),
				createAppHtml({
					entrySrc: createDevAppEntrySrc(toolFile.path),
				}),
			);
			const toolMeta =
				tool.config._meta && typeof tool.config._meta === "object"
					? (tool.config._meta as UnknownRecord)
					: {};
			const toolUiMeta =
				toolMeta.ui && typeof toolMeta.ui === "object"
					? (toolMeta.ui as UnknownRecord)
					: {};
			const resourceUiMeta =
				app.meta && typeof app.meta === "object"
					? (app.meta as UnknownRecord)
					: {};

			mcp.registerTool(
				tool.name,
				{
					...tool.config,
					_meta: {
						...toolMeta,
						ui: { ...toolUiMeta, resourceUri: uri },
					},
				},
				tool.handler,
			);
			mcp.registerResource(
				tool.name,
				uri,
				{
					description: tool.config.description,
					mimeType: RESOURCE_MIME_TYPE,
					_meta: { ui: resourceUiMeta },
				},
				async () => ({
					contents: [
						{
							uri,
							mimeType: RESOURCE_MIME_TYPE,
							text: html,
							_meta: { ui: resourceUiMeta },
						},
					],
				}),
			);
			continue;
		}

		mcp.registerTool(
			tool.name,
			tool.config as Parameters<McpServer["registerTool"]>[1],
			tool.handler,
		);
	}

	for (const resourceFile of files.resources) {
		const imported: UnknownRecord = await viteServer.ssrLoadModule(
			resourceFile.path,
		);
		const resource = readExport<ResourceDefinition>(
			imported,
			"resource",
			resourceFile.path,
		);

		mcp.registerResource(
			resource.name,
			resource.config.uri,
			resource.config as ResourceMetadata,
			resource.handler,
		);
	}

	for (const promptFile of files.prompts) {
		const imported: UnknownRecord = await viteServer.ssrLoadModule(
			promptFile.path,
		);
		const prompt = readExport<PromptDefinition>(
			imported,
			"prompt",
			promptFile.path,
		);

		mcp.registerPrompt(prompt.name, prompt.config, prompt.handler);
	}
}

export async function handleDevMcpRequest(
	viteServer: ViteDevServer,
	req: IncomingMessage,
	res: ServerResponse,
	serverInfo: DevMcpServerInfo,
): Promise<boolean> {
	if (!req.url || !isMcpPath(req.url)) {
		return false;
	}

	try {
		const body = await readJsonBody(req);
		const mcp = new McpServer({
			name: serverInfo.name,
			version: serverInfo.version,
		});
		await registerCollectedModules(mcp, viteServer);

		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
		});
		await mcp.connect(transport);
		await transport.handleRequest(req, res, body);
	} catch (error) {
		viteServer.config.logger.error(
			`[chapplin] Failed to handle ${MCP_PATH} request: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		if (!res.headersSent) {
			res.statusCode = 500;
			res.setHeader("content-type", "application/json");
			res.end(
				JSON.stringify({
					jsonrpc: "2.0",
					error: {
						code: -32603,
						message: "Internal server error",
					},
					id: null,
				}),
			);
		}
	}

	return true;
}
