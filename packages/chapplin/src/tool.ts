import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
	AnySchema,
	SchemaOutput,
	ShapeOutput,
	ZodRawShapeCompat,
} from "@modelcontextprotocol/sdk/server/zod-compat.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	CallToolResult,
	ServerNotification,
	ServerRequest,
	ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import type {
	ClientProvidedMeta,
	ComponentResourceMeta,
	OpenAiGlobals,
	ToolDescriptorMeta,
} from "./openai.js";
import { nameIntoId } from "./utils.js";

const mimeType = "text/html+skybridge";

export function defineTool<
	InputArgs extends Schema,
	OutputArgs extends Schema,
	OutputMeta extends UnknownObject | undefined,
	JSXElement,
>(
	name: string,
	config: {
		title?: string;
		description?: string;
		inputSchema?: InputArgs;
		outputSchema?: OutputArgs;
		annotations?: ToolAnnotations;
		_meta?: Record<string, unknown> &
			Omit<ToolDescriptorMeta, "openai/outputTemplate">;
	},
	cb: ToolCallback<InputArgs, OutputArgs, OutputMeta>,
	widget?: {
		/** If not specified, defaults to id */
		name?: string;
		_meta?: ComponentResourceMeta & Record<string, unknown>;
		app: (
			props: OpenAiGlobals<
				Shape<InputArgs>,
				Shape<OutputArgs>,
				OutputMeta extends undefined ? UnknownObject : OutputMeta
			>,
		) => JSXElement;
	},
): Tool<Shape<InputArgs>, Shape<OutputArgs>, OutputMeta> {
	type TypedTool = Tool<Shape<InputArgs>, Shape<OutputArgs>, OutputMeta>;
	if (typeof widget === "undefined") {
		return ((server) => {
			server.registerTool(name, config, cb);
		}) as TypedTool;
	}
	const id = nameIntoId(widget.name || name);
	const uri = `ui://widget/${id}.html`;
	const toolConfig = {
		...config,
		_meta: {
			...config._meta,
			"openai/outputTemplate": uri,
		} satisfies ToolDescriptorMeta,
	};

	/**
	 * HTML source
	 * `export default "<!doctype html><html>...</html>"`
	 */
	const html = import(`./widgets/${id}.js`).then((m) => m.default);

	return ((server) => {
		server.registerResource(widget.name || name, uri, {}, async () => ({
			contents: [{ uri, mimeType, text: await html, _meta: widget._meta }],
		}));
		server.registerTool(name, toolConfig, cb);
	}) as TypedTool;
}

type PromiseOr<T> = T | Promise<T>;
/** Zod schema */
type Schema = ZodRawShapeCompat | AnySchema;
type UnknownObject = Record<string, unknown>;
/** Infer type from Zod schema */
type Shape<T extends Schema | undefined> = T extends ZodRawShapeCompat
	? ShapeOutput<T>
	: T extends AnySchema
		? SchemaOutput<T>
		: Record<string, unknown>;

type ToolCallbackResult<
	OutputArgs extends Schema,
	OutputMeta extends UnknownObject | undefined,
> = PromiseOr<
	CallToolResult & {
		structuredContent: Shape<OutputArgs>;
		_meta?: OutputMeta & Record<string, unknown>;
	}
>;
type Extra = RequestHandlerExtra<ServerRequest, ServerNotification> & {
	_meta?: ClientProvidedMeta;
};
type ToolCallback<
	InputArgs extends Schema,
	OutputArgs extends Schema,
	OutputMeta extends UnknownObject | undefined,
> = InputArgs extends ZodRawShapeCompat
	? (
			args: ShapeOutput<InputArgs>,
			extra: Extra,
		) => ToolCallbackResult<OutputArgs, OutputMeta>
	: InputArgs extends AnySchema
		? (
				args: SchemaOutput<InputArgs>,
				extra: Extra,
			) => ToolCallbackResult<OutputArgs, OutputMeta>
		: never;

declare const __tool_phantom__: unique symbol;
export type Tool<Input, Output, Meta> = {
	(server: McpServer): void;

	/** For type inference, not for runtime use */
	[__tool_phantom__]?: { input: Input; output: Output; meta: Meta };
};

// biome-ignore lint/suspicious/noExplicitAny: This is for type inference
export type ToolInput<T> = T extends Tool<infer I, any, any> ? I : never;
// biome-ignore lint/suspicious/noExplicitAny: This is for type inference
export type ToolOutput<T> = T extends Tool<any, infer O, any> ? O : never;
// biome-ignore lint/suspicious/noExplicitAny: This is for type inference
export type ToolMeta<T> = T extends Tool<any, any, infer M> ? M : never;
