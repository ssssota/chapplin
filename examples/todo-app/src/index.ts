import { StreamableHTTPTransport } from "@hono/mcp";
import { serve } from "@hono/node-server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Hono } from "hono";
import get from "./tools/get.js";

const app = new Hono();

// Your MCP server implementation
const mcp = new McpServer({
	name: "my-mcp-server",
	version: "1.0.0",
});
get(mcp);

app.all("/mcp", async (c) => {
	const transport = new StreamableHTTPTransport();
	await mcp.connect(transport);
	return transport.handleRequest(c);
});

serve(app, console.log);
