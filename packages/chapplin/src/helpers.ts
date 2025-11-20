import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { defineTool } from "./tool.js";

export function applyTools(
	server: McpServer,
	tools: ReturnType<typeof defineTool>[],
): void {
	for (const tool of tools) tool(server);
}
