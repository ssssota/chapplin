import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it, vi } from "vitest";
import { applyTools } from "../src/helpers.js";

const createTool =
	(callback: ReturnType<typeof vi.fn>) =>
	(server: McpServer): void => {
		callback(server);
	};

describe("applyTools", () => {
	it("invokes each tool with the provided server", () => {
		const server = {} as McpServer;
		const firstTool = vi.fn();
		const secondTool = vi.fn();

		applyTools(server, [createTool(firstTool), createTool(secondTool)]);

		expect(firstTool).toHaveBeenCalledWith(server);
		expect(secondTool).toHaveBeenCalledWith(server);
	});
});
