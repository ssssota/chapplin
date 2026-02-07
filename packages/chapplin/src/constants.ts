/** Directory for built MCP App HTML files */
export const MCP_APPS_DIR = "__chapplin__/mcp";

/** Virtual module ID for registering tools/resources/prompts onto an McpServer */
export const VIRTUAL_MODULE_ID = "chapplin:register";

/** Resolved virtual module ID (with \0 prefix for Vite) */
export const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;

/** Default directories */
export const DEFAULT_TOOLS_DIR = "tools";
export const DEFAULT_RESOURCES_DIR = "resources";
export const DEFAULT_PROMPTS_DIR = "prompts";

/** MCP App MIME type */
export const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app";
