import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { applyTools } from "chapplin";
import express from "express";
import get from "./tools/get.js";

const app = express();
app.use(express.json());

// Your MCP server implementation
const mcp = new McpServer({
	name: "my-mcp-server",
	version: "1.0.0",
});
applyTools(mcp, [get]);

app.all("/mcp", async (req, res) => {
	const transport = new StreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
	});
	await mcp.connect(transport);
	await transport.handleRequest(req, res, req.body);
});

app.listen(3000, console.log);
