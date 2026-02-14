import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
	type CallToolResult,
	CallToolResultSchema,
	ListResourcesResultSchema,
	ListToolsResultSchema,
	type ReadResourceResult,
	ReadResourceResultSchema,
	type Resource,
	type Tool,
} from "@modelcontextprotocol/sdk/types.js";

export async function listTools(baseURL: string): Promise<Tool[]> {
	const result = await withMcpClient(baseURL, (client) =>
		client.request({ method: "tools/list" }, ListToolsResultSchema),
	);
	return result.tools;
}

export async function callTool(
	baseURL: string,
	options: {
		name: string;
		arguments?: Record<string, unknown>;
	},
): Promise<CallToolResult> {
	return withMcpClient(baseURL, (client) =>
		client.request(
			{ method: "tools/call", params: options },
			CallToolResultSchema,
		),
	);
}

export async function listResources(baseURL: string): Promise<Resource[]> {
	const result = await withMcpClient(baseURL, (client) =>
		client.request({ method: "resources/list" }, ListResourcesResultSchema),
	);
	return result.resources;
}

export async function readResource(
	baseURL: string,
	uri: string,
): Promise<ReadResourceResult> {
	return withMcpClient(baseURL, (client) =>
		client.request(
			{ method: "resources/read", params: { uri } },
			ReadResourceResultSchema,
		),
	);
}

async function withMcpClient<T>(
	baseURL: string,
	handler: (client: Client) => Promise<T>,
): Promise<T> {
	const transport = new StreamableHTTPClientTransport(new URL("/mcp", baseURL));
	const client = new Client(
		{ name: "chapplin-e2e", version: "0.0.0" },
		{ capabilities: {} },
	);
	await client.connect(transport);

	try {
		return await handler(client);
	} finally {
		await transport.close();
	}
}
