/**
 * define* API for chapplin-next.
 * Use defineTool, defineApp, defineResource, definePrompt in tool/resource/prompt files.
 */

import type {
	AppMeta,
	AppProps,
	PromptConfig,
	PromptHandler,
	ResourceConfig,
	ResourceHandler,
	ToolConfig,
	ToolHandler,
} from "./types.js";

// =============================================================================
// Tool
// =============================================================================

/** Options passed to defineTool */
export interface DefineToolOptions {
	name: string;
	config: ToolConfig;
	handler: ToolHandler;
}

/** Return type of defineTool (shape used by virtual module) */
export interface DefinedTool {
	name: string;
	config: ToolConfig;
	handler: ToolHandler;
}

export function defineTool(options: DefineToolOptions): DefinedTool {
	return {
		name: options.name,
		config: options.config,
		handler: options.handler,
	};
}

// =============================================================================
// App
// =============================================================================

/** Options passed to defineApp (ui is JSX component; Hono uses hono/jsx) */
export interface DefineAppOptions {
	meta?: AppMeta;
	ui: (props: AppProps) => unknown;
}

/** Return type of defineApp (shape used by virtual module and client build) */
export interface DefinedApp {
	meta?: AppMeta;
	ui: (props: AppProps) => unknown;
}

export function defineApp(_options: DefineAppOptions): DefinedApp {
	return {
		meta: _options.meta,
		ui: _options.ui,
	};
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

/** Return type of defineResource */
export interface DefinedResource {
	name: string;
	config: ResourceConfig;
	handler: ResourceHandler;
}

export function defineResource(options: DefineResourceOptions): DefinedResource {
	return {
		name: options.name,
		config: options.config,
		handler: options.handler,
	};
}

// =============================================================================
// Prompt
// =============================================================================

/** Options passed to definePrompt */
export interface DefinePromptOptions {
	name: string;
	config: PromptConfig;
	handler: PromptHandler;
}

/** Return type of definePrompt */
export interface DefinedPrompt {
	name: string;
	config: PromptConfig;
	handler: PromptHandler;
}

export function definePrompt(options: DefinePromptOptions): DefinedPrompt {
	return {
		name: options.name,
		config: options.config,
		handler: options.handler,
	};
}
