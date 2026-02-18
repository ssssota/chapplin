import type {
	McpUiHostContext,
	McpUiToolInputNotification,
	McpUiToolResultNotification,
} from "@modelcontextprotocol/ext-apps";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	CallToolResult,
	ServerNotification,
	ServerRequest,
	ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import type { ToolDescriptorMeta } from "./openai";

// =============================================================================
// Zod Schema Types
// =============================================================================

/**
 * Minimal schema contract for Zod compatibility.
 *
 * We intentionally avoid depending on concrete `z.ZodType` from a specific
 * zod package instance/version, because consumers can bring a different zod
 * minor version in workspace setups.
 */
export type ZodSchemaLike =
	| { _output: unknown } // zod v3/v4 classic
	| { _zod: { output: unknown } }; // zod v4 core

/** Zod raw shape (object schema definition) */
export type ZodRawShape = Record<string, ZodSchemaLike>;

/** Infer output type from schema-like type */
type InferSchemaOutput<TSchema> = TSchema extends { _output: infer TOutput }
	? TOutput
	: TSchema extends { _zod: { output: infer TOutput } }
		? TOutput
		: unknown;

/** Infer output type from Zod raw shape */
export type InferShapeOutput<T extends ZodRawShape> = {
	[K in keyof T]: InferSchemaOutput<T[K]>;
};

// =============================================================================
// Tool Types
// =============================================================================

/** Tool configuration */
export interface ToolConfig<
	TInput extends ZodRawShape = ZodRawShape,
	TOutput extends ZodRawShape = ZodRawShape,
> {
	/** Display title (optional) */
	title?: string;
	/** Description for LLM (required) */
	description: string;
	/** Input schema using Zod */
	inputSchema: TInput;
	/** Output schema using Zod (optional) */
	outputSchema: TOutput;
	/** Tool annotations */
	annotations?: ToolAnnotations;
	/** Metadata */
	_meta?: Record<string, unknown> & ToolDescriptorMeta;
}

/** Extra context passed to tool handler */
export type ToolHandlerExtra = RequestHandlerExtra<
	ServerRequest,
	ServerNotification
>;

/** Tool handler function */
export type ToolHandler<
	TInput extends ZodRawShape = ZodRawShape,
	TOutput extends ZodRawShape = ZodRawShape,
	TMeta extends Record<string, unknown> = Record<string, unknown>,
> = (
	args: InferShapeOutput<TInput>,
	extra: ToolHandlerExtra,
) => Promise<
	CallToolResult & {
		structuredContent?: InferShapeOutput<TOutput>;
		_meta?: TMeta;
	}
>;

/** Exports required from a tool file */
export interface ToolExports<
	TInput extends ZodRawShape = ZodRawShape,
	TOutput extends ZodRawShape = ZodRawShape,
> {
	/** Tool name (unique identifier) */
	name: string;
	/** Tool configuration */
	config: ToolConfig<TInput, TOutput>;
	/** Tool handler */
	handler: ToolHandler<TInput, TOutput>;
	/** MCP App metadata (required if App is exported) */
	appMeta?: AppMeta;
	/** MCP App component (optional) */
	App?: (props: AppProps<TInput, TOutput>) => unknown;
}

// =============================================================================
// Resource Types
// =============================================================================

/** Resource configuration */
export interface ResourceConfig {
	/** Resource URI */
	uri: string;
	/** Display title (optional) */
	title?: string;
	/** Description */
	description?: string;
	/** MIME type (default: application/json) */
	mimeType?: string;
}

/** Resource content item */
export interface ResourceContent {
	uri: string;
	mimeType?: string;
	text?: string;
	blob?: string;
}

/** Resource handler result */
export interface ResourceResult {
	contents: ResourceContent[];
}

/** Resource handler function */
export type ResourceHandler = (uri: URL) => Promise<ResourceResult>;

/** Exports required from a resource file */
export interface ResourceExports {
	/** Resource name */
	name: string;
	/** Resource configuration */
	config: ResourceConfig;
	/** Resource handler */
	handler: ResourceHandler;
}

// =============================================================================
// Prompt Types
// =============================================================================

/** Prompt configuration */
export interface PromptConfig<TArgs extends ZodRawShape = ZodRawShape> {
	/** Display title (optional) */
	title?: string;
	/** Description */
	description?: string;
	/** Arguments schema using Zod */
	argsSchema?: TArgs;
}

/** Prompt message */
export interface PromptMessage {
	role: "user" | "assistant";
	content:
		| { type: "text"; text: string }
		| { type: "image"; data: string; mimeType: string }
		| {
				type: "resource";
				resource: {
					uri: string;
					text?: string;
					blob?: string;
					mimeType?: string;
				};
		  };
}

/** Prompt handler result */
export interface PromptResult {
	messages: PromptMessage[];
	description?: string;
}

/** Prompt handler function */
export type PromptHandler<TArgs extends ZodRawShape = ZodRawShape> = (
	args: InferShapeOutput<TArgs>,
) => PromptResult;

/** Exports required from a prompt file */
export interface PromptExports<TArgs extends ZodRawShape = ZodRawShape> {
	/** Prompt name */
	name: string;
	/** Prompt configuration */
	config: PromptConfig<TArgs>;
	/** Prompt handler */
	handler: PromptHandler<TArgs>;
}

// =============================================================================
// MCP App Types
// =============================================================================

/** MCP App metadata (from @modelcontextprotocol/ext-apps) */
export interface AppMeta {
	/** Content Security Policy settings */
	csp?: {
		/** Allowed origins for fetch/XHR/WebSocket */
		connectDomains?: string[];
		/** Allowed origins for images/scripts/styles/fonts */
		resourceDomains?: string[];
		/** Allowed origins for iframes */
		frameDomains?: string[];
		/** Allowed origins for base URI */
		baseUriDomains?: string[];
	};
	/** Sandbox permissions */
	permissions?: {
		camera?: object;
		microphone?: object;
		geolocation?: object;
		clipboardWrite?: object;
	};
	/** Dedicated origin for CORS/OAuth */
	domain?: string;
	/** Show border around the app */
	prefersBorder?: boolean;
}

/** Props passed to MCP App component */
export interface AppProps<
	TInput extends ZodRawShape = ZodRawShape,
	TOutput extends ZodRawShape = ZodRawShape,
	TMeta extends Record<string, unknown> = Record<string, unknown>,
> {
	/** Tool input arguments */
	input?: McpUiToolInputNotification["params"] & {
		arguments?: InferShapeOutput<TInput>;
	};
	/** Tool output (null if not yet executed) */
	output?: McpUiToolResultNotification["params"] & {
		structuredContent?: InferShapeOutput<TOutput> | null;
		_meta?: TMeta;
	};
	/** Host context from MCP UI */
	hostContext?: McpUiHostContext;
}
