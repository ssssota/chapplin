import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

const HOST_CLIENT_INFO = {
	name: "chapplin-dev-ui-host",
	version: "0.1.0",
} as const;

function resolveMcpEndpoint(path = "/mcp"): URL {
	return new URL(path, window.location.origin);
}

export interface DevMcpConnection {
	client: Client;
	transport: StreamableHTTPClientTransport;
	close: () => Promise<void>;
}

export async function connectDevMcp(path = "/mcp"): Promise<DevMcpConnection> {
	const transport = new StreamableHTTPClientTransport(resolveMcpEndpoint(path));
	const client = new Client(HOST_CLIENT_INFO, {
		capabilities: {},
	});

	await client.connect(transport);

	return {
		client,
		transport,
		close: async () => {
			await Promise.allSettled([client.close(), transport.close()]);
		},
	};
}

export async function listDevTools(path = "/mcp"): Promise<Tool[]> {
	const connection = await connectDevMcp(path);
	try {
		const { tools } = await connection.client.listTools();
		return [...tools].sort((a, b) => a.name.localeCompare(b.name));
	} finally {
		await connection.close();
	}
}
