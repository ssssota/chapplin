import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { register } from "chapplin:register";
import express from "express";

const mode = process.argv[2] || "http";
const serverInfo = {
	name: "express-react-todo",
	version: "1.0.0",
};

if (mode === "stdio") {
	// STDIO transport mode (for CLI usage)
	const server = new McpServer(serverInfo);
	register(server);
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("MCP server started in STDIO mode");
} else {
	// HTTP transport mode (for web usage)
	const app = express();
	app.use(express.json());

	// Health check endpoint
	app.get("/health", (_req, res) => res.json({ status: "ok" }));

	// MCP endpoint using StreamableHTTPServerTransport (new server per request)
	app.all("/mcp", async (req, res) => {
		const server = new McpServer(serverInfo);
		register(server);
		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
		});
		await server.connect(transport);
		await transport.handleRequest(req, res, req.body);
	});

	const port = Number(process.env.PORT) || 3000;
	app.listen(port, () => {
		console.log(`MCP server started at http://localhost:${port}/mcp`);
	});
}
