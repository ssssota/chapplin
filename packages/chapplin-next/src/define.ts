/**
 * define* API for chapplin-next.
 * Use defineTool, defineApp, defineResource, definePrompt in tool/resource/prompt files.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type {
	AppMeta,
	AppProps,
	InferShapeOutput,
	PromptConfig,
	PromptHandler,
	ResourceConfig,
	ResourceHandler,
	ToolConfig,
	ToolHandler,
	ToolHandlerExtra,
	ZodRawShape,
} from "./types.js";

// =============================================================================
// Tool
// =============================================================================

/**
 * Define a tool with type inference.
 * The input, output, and meta types are automatically inferred from schemas and handler return type.
 *
 * @example
 * ```ts
 * export const tool = defineTool({
 *   name: "get_weather",
 *   config: {
 *     description: "Get weather for a city",
 *     inputSchema: { city: z.string() },
 *     outputSchema: { temperature: z.number() },
 *   },
 *   handler: async (args) => {
 *     // args.city is typed as string
 *     return {
 *       content: [],
 *       structuredContent: { temperature: 20 },
 *       _meta: { chartData: [...] }, // UI-only data (not sent to LLM)
 *     };
 *   },
 * });
 * ```
 */
export function defineTool<
	const TName extends string,
	const TInput extends ZodRawShape,
	const TOutput extends ZodRawShape,
	TMeta extends Record<string, unknown> = Record<string, unknown>,
>(options: {
	name: TName;
	config: {
		title?: string;
		description: string;
		inputSchema: TInput;
		outputSchema: TOutput;
		annotations?: ToolConfig["annotations"];
	};
	handler: (
		args: InferShapeOutput<TInput>,
		extra: ToolHandlerExtra,
	) => Promise<
		CallToolResult & {
			structuredContent?: InferShapeOutput<TOutput>;
			_meta?: TMeta;
		}
	>;
}): {
	name: TName;
	config: {
		title?: string;
		description: string;
		inputSchema: TInput;
		outputSchema: TOutput;
		annotations?: ToolConfig["annotations"];
	};
	handler: ToolHandler<TInput, TOutput, TMeta>;
} {
	return options;
}

/** Type alias for the return type of defineTool */
export type DefinedTool<
	TName extends string = string,
	TInput extends ZodRawShape = ZodRawShape,
	TOutput extends ZodRawShape = ZodRawShape,
> = {
	name: TName;
	config: ToolConfig<TInput, TOutput>;
	handler: ToolHandler<TInput, TOutput>;
};

/** Helper type to extract input type from a tool definition */
export type InferToolInput<T extends DefinedTool> =
	T["config"]["inputSchema"] extends ZodRawShape
		? InferShapeOutput<T["config"]["inputSchema"]>
		: Record<string, unknown>;

/** Helper type to extract output type from a tool definition */
export type InferToolOutput<T extends DefinedTool> =
	T["config"]["outputSchema"] extends ZodRawShape
		? InferShapeOutput<T["config"]["outputSchema"]>
		: unknown;

// =============================================================================
// App
// =============================================================================

/** Base interface for app definition */
export interface AppDefinition<
	TInput extends ZodRawShape = ZodRawShape,
	TOutput extends ZodRawShape = ZodRawShape,
	TMeta extends Record<string, unknown> = Record<string, unknown>,
> {
	meta?: AppMeta;
	ui: (props: AppProps<TInput, TOutput, TMeta>) => unknown;
}

/** Helper type to extract _meta type from handler return type */
type ExtractMeta<T> = T extends {
	handler: (...args: never[]) => Promise<infer R>;
}
	? R extends { _meta?: infer M }
		? M extends Record<string, unknown>
			? M
			: Record<string, unknown>
		: Record<string, unknown>
	: Record<string, unknown>;

/**
 * Define an MCP App with type inference.
 * Use with typeof tool to get type-safe input/output/meta props:
 *
 * @example
 * ```tsx
 * export const tool = defineTool({
 *   ...,
 *   handler: async (args) => ({
 *     content: [],
 *     _meta: { chartData: [...] },
 *   }),
 * });
 * export const app = defineApp<typeof tool>({
 *   ui: (props) => {
 *     // props.meta has type { chartData: ... } | null
 *     return <Chart data={props.meta?.chartData} />;
 *   }
 * });
 * ```
 */
export function defineApp<
	TTool extends {
		config: { inputSchema: ZodRawShape; outputSchema: ZodRawShape };
		handler: (...args: never[]) => Promise<CallToolResult>;
	},
>(
	app: AppDefinition<
		TTool["config"]["inputSchema"],
		TTool["config"]["outputSchema"],
		ExtractMeta<TTool>
	>,
): typeof app {
	return app;
}

// =============================================================================
// Resource
// =============================================================================

/** Options passed to defineResource */
export interface DefineResourceOptions {
	name: string;
	config: ResourceConfig;
	handler: ResourceHandler;
}

export function defineResource<T extends DefineResourceOptions>(options: T): T {
	return options;
}

// =============================================================================
// Prompt
// =============================================================================

/**
 * Define a prompt with type inference.
 * The args type is automatically inferred from config.argsSchema.
 */
export function definePrompt<
	const TName extends string,
	const TArgs extends ZodRawShape,
>(options: {
	name: TName;
	config: {
		title?: string;
		description?: string;
		argsSchema?: TArgs;
	};
	handler: PromptHandler<TArgs>;
}): {
	name: TName;
	config: PromptConfig<TArgs>;
	handler: PromptHandler<TArgs>;
} {
	return options as ReturnType<typeof definePrompt<TName, TArgs>>;
}

/** Type alias for the return type of definePrompt */
export type DefinedPrompt<
	TName extends string = string,
	TArgs extends ZodRawShape = ZodRawShape,
> = {
	name: TName;
	config: PromptConfig<TArgs>;
	handler: PromptHandler<TArgs>;
};
