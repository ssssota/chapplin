import { describe, expect, it } from "vitest";
import { parsePromptFile, parseResourceFile, parseToolFile } from "./parser.js";

describe("parseToolFile", () => {
	it("should detect defineTool export", async () => {
		const code = `
			import { defineTool } from "chapplin-next";
			import z from "zod";

			export const tool = defineTool({
				name: "weather",
				config: {
					description: "Get weather data",
					inputSchema: { city: z.string() },
				},
				handler: async ({ city }) => ({ content: [] }),
			});
		`;
		const result = await parseToolFile("test.ts", code);

		expect(result.hasTool).toBe(true);
		expect(result.hasApp).toBe(false);
		expect(result.name).toBe("weather");
	});

	it("should detect defineApp export", async () => {
		const code = `
			import { defineTool, defineApp } from "chapplin-next";

			export const tool = defineTool({
				name: "todos",
				config: { description: "Manage todos" },
				handler: async () => ({ content: [] }),
			});

			export const app = defineApp({
				ui: () => <div>Hello</div>,
			});
		`;
		const result = await parseToolFile("test.tsx", code);

		expect(result.hasTool).toBe(true);
		expect(result.hasApp).toBe(true);
		expect(result.name).toBe("todos");
	});

	it("should extract inputSchema source", async () => {
		const code = `
			import { defineTool } from "chapplin-next";
			import z from "zod";

			export const tool = defineTool({
				name: "test",
				config: {
					description: "Test tool",
					inputSchema: { query: z.string(), limit: z.number() },
				},
				handler: async () => ({ content: [] }),
			});
		`;
		const result = await parseToolFile("test.ts", code);

		expect(result.inputSchemaSource).toBe(
			"{ query: z.string(), limit: z.number() }",
		);
	});

	it("should extract outputSchema source", async () => {
		const code = `
			import { defineTool } from "chapplin-next";
			import z from "zod";

			export const tool = defineTool({
				name: "test",
				config: {
					description: "Test tool",
					inputSchema: { query: z.string() },
					outputSchema: { result: z.string(), count: z.number() },
				},
				handler: async () => ({ content: [] }),
			});
		`;
		const result = await parseToolFile("test.ts", code);

		expect(result.outputSchemaSource).toBe(
			"{ result: z.string(), count: z.number() }",
		);
	});

	it("should return default values for non-tool file", async () => {
		const code = `
			export const someFunction = () => {};
		`;
		const result = await parseToolFile("test.ts", code);

		expect(result.hasTool).toBe(false);
		expect(result.hasApp).toBe(false);
		expect(result.name).toBe(null);
	});

	it("should handle tool without name", async () => {
		const code = `
			import { defineTool } from "chapplin-next";

			export const tool = defineTool({
				config: { description: "No name tool" },
				handler: async () => ({ content: [] }),
			});
		`;
		const result = await parseToolFile("test.ts", code);

		expect(result.hasTool).toBe(true);
		expect(result.name).toBe(null);
	});
});

describe("parseResourceFile", () => {
	it("should detect defineResource export", async () => {
		const code = `
			import { defineResource } from "chapplin-next";

			export const resource = defineResource({
				name: "config",
				config: {
					uri: "config://app/settings",
					description: "Application settings",
				},
				handler: async () => ({ contents: [] }),
			});
		`;
		const result = await parseResourceFile("test.ts", code);

		expect(result.hasResource).toBe(true);
		expect(result.name).toBe("config");
		expect(result.uri).toBe("config://app/settings");
	});

	it("should return default values for non-resource file", async () => {
		const code = `
			export const something = {};
		`;
		const result = await parseResourceFile("test.ts", code);

		expect(result.hasResource).toBe(false);
		expect(result.name).toBe(null);
		expect(result.uri).toBe(null);
	});

	it("should handle resource without name", async () => {
		const code = `
			import { defineResource } from "chapplin-next";

			export const resource = defineResource({
				config: {
					uri: "file://test",
					description: "Test",
				},
				handler: async () => ({ contents: [] }),
			});
		`;
		const result = await parseResourceFile("test.ts", code);

		expect(result.hasResource).toBe(true);
		expect(result.name).toBe(null);
		expect(result.uri).toBe("file://test");
	});
});

describe("parsePromptFile", () => {
	it("should detect definePrompt export", async () => {
		const code = `
			import { definePrompt } from "chapplin-next";
			import z from "zod";

			export const prompt = definePrompt({
				name: "code-review",
				config: {
					description: "Review code",
					argsSchema: { language: z.string() },
				},
				handler: async ({ language }) => ({ messages: [] }),
			});
		`;
		const result = await parsePromptFile("test.ts", code);

		expect(result.hasPrompt).toBe(true);
		expect(result.name).toBe("code-review");
	});

	it("should extract argsSchema source", async () => {
		const code = `
			import { definePrompt } from "chapplin-next";
			import z from "zod";

			export const prompt = definePrompt({
				name: "test",
				config: {
					description: "Test",
					argsSchema: { topic: z.string(), depth: z.number() },
				},
				handler: async () => ({ messages: [] }),
			});
		`;
		const result = await parsePromptFile("test.ts", code);

		expect(result.argsSchemaSource).toBe(
			"{ topic: z.string(), depth: z.number() }",
		);
	});

	it("should return default values for non-prompt file", async () => {
		const code = `
			export const helper = () => {};
		`;
		const result = await parsePromptFile("test.ts", code);

		expect(result.hasPrompt).toBe(false);
		expect(result.name).toBe(null);
		expect(result.argsSchemaSource).toBe(null);
	});

	it("should handle prompt without argsSchema", async () => {
		const code = `
			import { definePrompt } from "chapplin-next";

			export const prompt = definePrompt({
				name: "simple",
				config: { description: "Simple prompt" },
				handler: async () => ({ messages: [] }),
			});
		`;
		const result = await parsePromptFile("test.ts", code);

		expect(result.hasPrompt).toBe(true);
		expect(result.name).toBe("simple");
		expect(result.argsSchemaSource).toBe(null);
	});
});
