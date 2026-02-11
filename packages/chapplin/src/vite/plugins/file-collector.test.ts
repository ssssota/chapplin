import { describe, expect, it } from "vitest";

/** Regex patterns for detecting define* calls (copied from file-collector.ts for testing) */
const DEFINE_TOOL_PATTERN = /\bdefineTool\s*\(/;
const DEFINE_APP_PATTERN = /\bdefineApp\s*[<(]/;
const DEFINE_RESOURCE_PATTERN = /\bdefineResource\s*\(/;
const DEFINE_PROMPT_PATTERN = /\bdefinePrompt\s*\(/;

describe("file-collector regex patterns", () => {
	describe("DEFINE_TOOL_PATTERN", () => {
		it("should match basic defineTool call", () => {
			const code = `export const tool = defineTool({ name: "test" });`;
			expect(DEFINE_TOOL_PATTERN.test(code)).toBe(true);
		});

		it("should match defineTool with newline before paren", () => {
			const code = `export const tool = defineTool\n({ name: "test" });`;
			expect(DEFINE_TOOL_PATTERN.test(code)).toBe(true);
		});

		it("should match defineTool with spaces", () => {
			const code = `export const tool = defineTool  ({ name: "test" });`;
			expect(DEFINE_TOOL_PATTERN.test(code)).toBe(true);
		});

		it("should not match defineToolSomething (different function)", () => {
			const code = `defineToolSomething({})`;
			expect(DEFINE_TOOL_PATTERN.test(code)).toBe(false);
		});

		it("should not match myDefineTool (prefixed function)", () => {
			const code = `myDefineTool({})`;
			expect(DEFINE_TOOL_PATTERN.test(code)).toBe(false);
		});

		it("should match when preceded by word boundary", () => {
			const code = `const x = defineTool({});`;
			expect(DEFINE_TOOL_PATTERN.test(code)).toBe(true);
		});

		it("should match when in import statement context", () => {
			// This tests that the pattern doesn't require export
			const code = `import { defineTool } from "chapplin";\nconst t = defineTool({});`;
			expect(DEFINE_TOOL_PATTERN.test(code)).toBe(true);
		});
	});

	describe("DEFINE_APP_PATTERN", () => {
		it("should match basic defineApp call", () => {
			const code = `export const app = defineApp({ ui: () => null });`;
			expect(DEFINE_APP_PATTERN.test(code)).toBe(true);
		});

		it("should match defineApp with generic type parameter", () => {
			const code = `export const app = defineApp<typeof tool>({ ui: () => null });`;
			expect(DEFINE_APP_PATTERN.test(code)).toBe(true);
		});

		it("should match defineApp with spaces before generic", () => {
			const code = `export const app = defineApp  <typeof tool>({ ui: () => null });`;
			expect(DEFINE_APP_PATTERN.test(code)).toBe(true);
		});

		it("should match defineApp with newline before generic", () => {
			const code = `export const app = defineApp\n<typeof tool>({ ui: () => null });`;
			expect(DEFINE_APP_PATTERN.test(code)).toBe(true);
		});

		it("should not match defineAppSomething", () => {
			const code = `defineAppSomething({})`;
			expect(DEFINE_APP_PATTERN.test(code)).toBe(false);
		});

		it("should not match myDefineApp", () => {
			const code = `myDefineApp({})`;
			expect(DEFINE_APP_PATTERN.test(code)).toBe(false);
		});
	});

	describe("DEFINE_RESOURCE_PATTERN", () => {
		it("should match basic defineResource call", () => {
			const code = `export const resource = defineResource({ name: "config" });`;
			expect(DEFINE_RESOURCE_PATTERN.test(code)).toBe(true);
		});

		it("should match defineResource with spaces", () => {
			const code = `export const resource = defineResource   ({ name: "config" });`;
			expect(DEFINE_RESOURCE_PATTERN.test(code)).toBe(true);
		});

		it("should not match defineResourceSomething", () => {
			const code = `defineResourceSomething({})`;
			expect(DEFINE_RESOURCE_PATTERN.test(code)).toBe(false);
		});

		it("should not match myDefineResource", () => {
			const code = `myDefineResource({})`;
			expect(DEFINE_RESOURCE_PATTERN.test(code)).toBe(false);
		});
	});

	describe("DEFINE_PROMPT_PATTERN", () => {
		it("should match basic definePrompt call", () => {
			const code = `export const prompt = definePrompt({ name: "review" });`;
			expect(DEFINE_PROMPT_PATTERN.test(code)).toBe(true);
		});

		it("should match definePrompt with spaces", () => {
			const code = `export const prompt = definePrompt  ({ name: "review" });`;
			expect(DEFINE_PROMPT_PATTERN.test(code)).toBe(true);
		});

		it("should not match definePromptSomething", () => {
			const code = `definePromptSomething({})`;
			expect(DEFINE_PROMPT_PATTERN.test(code)).toBe(false);
		});

		it("should not match myDefinePrompt", () => {
			const code = `myDefinePrompt({})`;
			expect(DEFINE_PROMPT_PATTERN.test(code)).toBe(false);
		});
	});

	describe("pattern combinations in realistic code", () => {
		it("should detect tool and app in same file", () => {
			const code = `
import { defineTool, defineApp } from "chapplin";
import z from "zod";

export const tool = defineTool({
  name: "chart",
  config: { inputSchema: { data: z.string() }, outputSchema: { id: z.string() } },
  handler: async () => ({ content: [], structuredContent: { id: "1" } }),
});

export const app = defineApp<typeof tool>({
  ui: (props) => <div>{props.output?.id}</div>,
});
`;
			expect(DEFINE_TOOL_PATTERN.test(code)).toBe(true);
			expect(DEFINE_APP_PATTERN.test(code)).toBe(true);
			expect(DEFINE_RESOURCE_PATTERN.test(code)).toBe(false);
			expect(DEFINE_PROMPT_PATTERN.test(code)).toBe(false);
		});

		it("should detect resource only", () => {
			const code = `
import { defineResource } from "chapplin";

export const resource = defineResource({
  name: "config",
  config: { uri: "config://app" },
  handler: async () => ({ contents: [] }),
});
`;
			expect(DEFINE_TOOL_PATTERN.test(code)).toBe(false);
			expect(DEFINE_APP_PATTERN.test(code)).toBe(false);
			expect(DEFINE_RESOURCE_PATTERN.test(code)).toBe(true);
			expect(DEFINE_PROMPT_PATTERN.test(code)).toBe(false);
		});

		it("should detect prompt only", () => {
			const code = `
import { definePrompt } from "chapplin";
import z from "zod";

export const prompt = definePrompt({
  name: "code-review",
  config: {
    argsSchema: { code: z.string() },
  },
  handler: (args) => ({ messages: [] }),
});
`;
			expect(DEFINE_TOOL_PATTERN.test(code)).toBe(false);
			expect(DEFINE_APP_PATTERN.test(code)).toBe(false);
			expect(DEFINE_RESOURCE_PATTERN.test(code)).toBe(false);
			expect(DEFINE_PROMPT_PATTERN.test(code)).toBe(true);
		});

		it("should not match plain text mentioning define* without parentheses", () => {
			// Pattern requires opening paren or < after define*, so plain text won't match
			const code = `
// defineTool is used for creating tools
// defineApp is used for UI
const x = 1;
`;
			expect(DEFINE_TOOL_PATTERN.test(code)).toBe(false);
			expect(DEFINE_APP_PATTERN.test(code)).toBe(false);
		});

		it("should match comments containing actual define* calls", () => {
			// If someone pastes actual code in comments, it will match
			// This is acceptable - false positives are better than false negatives
			const code = `
// Example: defineTool({ name: "test" })
const x = 1;
`;
			expect(DEFINE_TOOL_PATTERN.test(code)).toBe(true);
		});

		it("should match string literals containing actual define* calls", () => {
			// If someone has code in a string literal, it will match
			// This is acceptable - false positives are better than false negatives
			const code = `
const example = "defineTool({ name: 'test' })";
`;
			expect(DEFINE_TOOL_PATTERN.test(code)).toBe(true);
		});
	});
});
