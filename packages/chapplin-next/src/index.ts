/**
 * chapplin-next
 * All-in-one framework for building MCP Server with MCP Apps
 */

// define* API (use in tools/, resources/, prompts/ files)
export {
	defineApp,
	definePrompt,
	defineResource,
	defineTool,
} from "./define.js";
export type {
	DefinedApp,
	DefinedPrompt,
	DefinedResource,
	DefinedTool,
	DefineAppOptions,
	DefinePromptOptions,
	DefineResourceOptions,
	DefineToolOptions,
} from "./define.js";

// Re-export constants
export { MCP_APPS_DIR, VIRTUAL_MODULE_ID } from "./constants.js";
// Re-export types
export type {
	AppMeta,
	AppProps,
	PromptConfig,
	PromptExports,
	PromptHandler,
	ResourceConfig,
	ResourceExports,
	ResourceHandler,
	ToolConfig,
	ToolExports,
	ToolHandler,
} from "./types.js";
