import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	CallToolResult,
	ServerNotification,
	ServerRequest,
	ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import type z from "zod";
import type {
	ClientProvidedMeta,
	ComponentResourceMeta,
	OpenAiGlobals,
	ToolDescriptorMeta,
} from "./openai.js";

const mimeType = "text/html+skybridge";

export function defineTool<
	InputArgs extends Schema,
	OutputArgs extends Schema,
	OutputMeta extends Schema | undefined,
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
				Shape<OutputMeta>
			>,
		) => JSXElement;
	},
): Mount {
	if (typeof widget === "undefined") {
		return (server) => server.registerTool(name, config, cb);
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

	return (server) => {
		server.registerResource(widget.name || name, uri, {}, async () => ({
			contents: [{ uri, mimeType, text: await html, _meta: widget._meta }],
		}));
		server.registerTool(name, toolConfig, cb);
	};
}

type PromiseOr<T> = T | Promise<T>;
/** Zod schema */
type Schema = z.ZodRawShape | z.ZodType<Record<string, unknown>>;
/** Infer type from Zod schema */
type Shape<T extends Schema | undefined> = T extends z.ZodRawShape
	? z.objectOutputType<T, z.ZodTypeAny>
	: T extends z.ZodType<infer U>
		? U
		: Record<string, unknown>;

type ToolCallbackResult<
	OutputArgs extends Schema,
	OutputMeta extends Schema | undefined,
> = PromiseOr<
	CallToolResult & {
		structuredContent: Shape<OutputArgs>;
		_meta?: Shape<OutputMeta> & Record<string, unknown>;
	}
>;
type Extra = RequestHandlerExtra<ServerRequest, ServerNotification> & {
	_meta?: ClientProvidedMeta;
};
type ToolCallback<
	InputArgs extends Schema,
	OutputArgs extends Schema,
	OutputMeta extends Schema | undefined,
> = InputArgs extends z.ZodRawShape
	? (
			args: z.objectOutputType<InputArgs, z.ZodTypeAny>,
			extra: Extra,
		) => ToolCallbackResult<OutputArgs, OutputMeta>
	: InputArgs extends z.ZodType<infer T>
		? (args: T, extra: Extra) => ToolCallbackResult<OutputArgs, OutputMeta>
		: never;
type Mount = (server: McpServer) => void;

function nameIntoId(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
}
