import { register } from "chapplin:register";
import { StreamableHTTPTransport } from "@hono/mcp";
import { serve } from "@hono/node-server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Hono } from "hono";

// HTTP transport mode (for web usage)
const app = new Hono();

// Health check endpoint
app.get("/health", (c) => c.json({ status: "ok" }));

// MCP endpoint using StreamableHTTPTransport (new server per request)
app.all("/mcp", async (c) => {
	const server = new McpServer({
		name: "chapplin-sample",
		version: "1.0.0",
	});
	register(server);
	const transport = new StreamableHTTPTransport();
	await server.connect(transport);
	return transport.handleRequest(c);
});

const port = Number(process.env.PORT) || 4173;
console.log(`MCP server started at http://localhost:${port}/mcp`);
serve({ fetch: app.fetch, port });
