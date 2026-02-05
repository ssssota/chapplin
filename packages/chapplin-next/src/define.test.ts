import { describe, expect, expectTypeOf, it } from "vitest";
import z from "zod";
import {
	defineApp,
	definePrompt,
	defineResource,
	defineTool,
} from "./define.js";
import type { AppProps, InferShapeOutput } from "./types.js";

describe("defineTool", () => {
	it("should return tool definition with all properties", () => {
		const handler = async () => ({ content: [] });
		const result = defineTool({
			name: "weather",
			config: {
				description: "Get weather data",
				inputSchema: { city: z.string() },
				outputSchema: {},
			},
			handler,
		});

		expect(result.name).toBe("weather");
		expect(result.config.description).toBe("Get weather data");
		expect(result.config.inputSchema).toHaveProperty("city");
		expect(result.handler).toBe(handler);
	});

	it("should preserve optional config properties", () => {
		const result = defineTool({
			name: "test",
			config: {
				description: "Test",
				inputSchema: { value: z.string() },
				outputSchema: { result: z.string() },
			},
			handler: async () => ({ content: [] }),
		});

		expect(result.config.outputSchema).toHaveProperty("result");
	});

	it("should infer input/output types from zod schemas", () => {
		const tool = defineTool({
			name: "weather",
			config: {
				description: "Get weather",
				inputSchema: {
					city: z.string(),
					unit: z.enum(["celsius", "fahrenheit"]),
				},
				outputSchema: {
					temperature: z.number(),
					condition: z.string(),
				},
			},
			handler: async (args) => {
				// Type inference check: args should have city and unit
				expectTypeOf(args.city).toBeString();
				expectTypeOf(args.unit).toEqualTypeOf<"celsius" | "fahrenheit">();
				return {
					content: [],
					structuredContent: {
						temperature: 20,
						condition: "sunny",
					},
				};
			},
		});

		// Check that tool preserves the literal name type
		expectTypeOf(tool.name).toEqualTypeOf<"weather">();

		// Check inferred types via config.inputSchema/outputSchema
		type Input = InferShapeOutput<typeof tool.config.inputSchema>;
		type Output = InferShapeOutput<typeof tool.config.outputSchema>;

		// Verify types are correctly inferred
		const input: Input = { city: "Tokyo", unit: "celsius" };
		const output: Output = { temperature: 20, condition: "sunny" };
		expectTypeOf(input.city).toBeString();
		expectTypeOf(input.unit).toEqualTypeOf<"celsius" | "fahrenheit">();
		expectTypeOf(output.temperature).toBeNumber();
		expectTypeOf(output.condition).toBeString();
	});

	it("should reject incorrect handler argument types", () => {
		defineTool({
			name: "test",
			config: {
				description: "Test",
				inputSchema: {
					count: z.number(),
				},
				outputSchema: {},
			},
			handler: async (args) => {
				// @ts-expect-error - count is number, not string
				const _s: string = args.count;
				return { content: [] };
			},
		});
	});

	it("should reject incorrect structuredContent types", () => {
		defineTool({
			name: "test",
			config: {
				description: "Test",
				inputSchema: { value: z.string() },
				outputSchema: {
					result: z.string(),
				},
			},
			// @ts-expect-error - result should be string, not number
			handler: async () => ({
				content: [],
				structuredContent: {
					result: 123,
				},
			}),
		});
	});
});

describe("defineApp", () => {
	it("should return app definition with ui component", () => {
		const tool = defineTool({
			name: "test",
			config: {
				description: "Test tool",
				inputSchema: {},
				outputSchema: {},
			},
			handler: async () => ({ content: [] }),
		});
		const ui = () => "Hello";
		const result = defineApp<typeof tool>({ ui });

		expect(result.ui).toBe(ui);
		expect(result.meta).toBeUndefined();
	});

	it("should include meta when provided", () => {
		const tool = defineTool({
			name: "test",
			config: {
				description: "Test tool",
				inputSchema: {},
				outputSchema: {},
			},
			handler: async () => ({ content: [] }),
		});
		const ui = () => "Hello";
		const meta = { prefersBorder: true };
		const result = defineApp<typeof tool>({ ui, meta });

		expect(result.ui).toBe(ui);
		expect(result.meta).toEqual({ prefersBorder: true });
	});

	it("should infer props types from tool definition", () => {
		const tool = defineTool({
			name: "chart",
			config: {
				description: "Show chart",
				inputSchema: {
					data: z.array(z.object({ x: z.number(), y: z.number() })),
					chartType: z.enum(["bar", "line"]),
				},
				outputSchema: {
					chartId: z.string(),
				},
			},
			handler: async () => ({
				content: [],
				structuredContent: { chartId: "abc" },
			}),
		});

		const app = defineApp<typeof tool>({
			ui: (props) => {
				// Type inference check: props.input should have data and chartType
				expectTypeOf(props.input.data).toEqualTypeOf<
					Array<{ x: number; y: number }>
				>();
				expectTypeOf(props.input.chartType).toEqualTypeOf<"bar" | "line">();

				// Type inference check: props.output should have chartId or be null
				type ExpectedOutput = { chartId: string } | null;
				expectTypeOf(props.output).toExtend<ExpectedOutput>();

				return "chart";
			},
		});

		// Verify the app's ui function signature matches AppProps
		type ExpectedInput = typeof tool.config.inputSchema;
		type ExpectedOutput = typeof tool.config.outputSchema;
		expectTypeOf(app.ui)
			.parameter(0)
			.toExtend<AppProps<ExpectedInput, ExpectedOutput>>();
	});

	it("should infer _meta types from tool handler", () => {
		const tool = defineTool({
			name: "chart-with-meta",
			config: {
				description: "Show chart with UI-only data",
				inputSchema: {
					query: z.string(),
				},
				outputSchema: {
					summary: z.string(),
				},
			},
			handler: async () => ({
				content: [],
				structuredContent: { summary: "Data loaded" },
				// _meta contains UI-only data not sent to LLM
				_meta: {
					chartData: [
						{ x: 1, y: 10 },
						{ x: 2, y: 20 },
					],
					renderOptions: { animate: true },
				},
			}),
		});

		const app = defineApp<typeof tool>({
			ui: (props) => {
				// props.meta should be typed, access it with null check
				if (props.meta !== null) {
					// These should type check correctly
					const _chartData: Array<{ x: number; y: number }> =
						props.meta.chartData;
					const _options: { animate: boolean } = props.meta.renderOptions;
					expect(_chartData).toBeDefined();
					expect(_options).toBeDefined();
				}
				return "chart";
			},
		});

		expect(app).toBeDefined();
	});
});

describe("defineResource", () => {
	it("should return resource definition with all properties", () => {
		const handler = async () => ({ contents: [] });
		const result = defineResource({
			name: "config",
			config: {
				uri: "config://app/settings",
				description: "App settings",
			},
			handler,
		});

		expect(result.name).toBe("config");
		expect(result.config.uri).toBe("config://app/settings");
		expect(result.config.description).toBe("App settings");
		expect(result.handler).toBe(handler);
	});

	it("should preserve optional config properties", () => {
		const result = defineResource({
			name: "file",
			config: {
				uri: "file://test.txt",
				mimeType: "text/plain",
			},
			handler: async () => ({ contents: [] }),
		});

		expect(result.config.mimeType).toBe("text/plain");
	});
});

describe("definePrompt", () => {
	it("should return prompt definition with all properties", () => {
		const handler = () => ({ messages: [] });
		const result = definePrompt({
			name: "code-review",
			config: {
				description: "Review code for issues",
				argsSchema: { language: z.string() },
			},
			handler,
		});

		expect(result.name).toBe("code-review");
		expect(result.config.description).toBe("Review code for issues");
		expect(result.config.argsSchema).toHaveProperty("language");
		expect(result.handler).toBe(handler);
	});

	it("should work without argsSchema", () => {
		const result = definePrompt({
			name: "simple",
			config: {
				description: "Simple prompt",
			},
			handler: () => ({ messages: [] }),
		});

		expect(result.name).toBe("simple");
		expect(result.config.argsSchema).toBeUndefined();
	});

	it("should infer args types from argsSchema", () => {
		const prompt = definePrompt({
			name: "review",
			config: {
				description: "Code review",
				argsSchema: {
					code: z.string(),
					language: z.enum(["typescript", "javascript", "python"]),
				},
			},
			handler: (args) => {
				// Type inference check
				expectTypeOf(args.code).toBeString();
				expectTypeOf(args.language).toEqualTypeOf<
					"typescript" | "javascript" | "python"
				>();
				return { messages: [] };
			},
		});

		// Check that prompt preserves the literal name type
		expectTypeOf(prompt.name).toEqualTypeOf<"review">();
	});
});
