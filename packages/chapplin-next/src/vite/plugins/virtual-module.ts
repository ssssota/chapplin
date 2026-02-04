import type { Plugin, ResolvedConfig } from "vite";
import {
	MCP_APP_MIME_TYPE,
	MCP_APPS_DIR,
	RESOLVED_VIRTUAL_MODULE_ID,
	VIRTUAL_MODULE_ID,
} from "../../constants.js";
import type { Options } from "../types.js";
import { nameToIdentifier, resolveOptions } from "../utils.js";
import { getBuiltAppHtml } from "./client-build.js";
import { getCollectedFiles } from "./file-collector.js";

/** Virtual module prefix for app HTML */
const APP_HTML_PREFIX = "virtual:chapplin-app-html:";

/**
 * Plugin that provides the virtual module `chapplin:mcp-server`
 */
export function virtualModule(opts: Options): Plugin {
	const resolvedOpts = resolveOptions(opts);
	let config: ResolvedConfig;

	return {
		name: "chapplin:virtual-module",
		configResolved(resolvedConfig) {
			config = resolvedConfig;
		},
		resolveId(id) {
			if (id === VIRTUAL_MODULE_ID) {
				return RESOLVED_VIRTUAL_MODULE_ID;
			}
			// Resolve app HTML virtual modules
			if (id.startsWith(APP_HTML_PREFIX)) {
				return `\0${id}`;
			}
		},
		async load(id) {
			if (id === RESOLVED_VIRTUAL_MODULE_ID) {
				const files = getCollectedFiles(config);
				return generateVirtualModuleCode(files, resolvedOpts, config);
			}
			// Load app HTML virtual modules
			if (id.startsWith(`\0${APP_HTML_PREFIX}`)) {
				const toolName = id.slice(`\0${APP_HTML_PREFIX}`.length);
				const html = await getBuiltAppHtml(toolName);
				if (html) {
					return `export default ${JSON.stringify(html)};`;
				}
				// Return empty placeholder if not built yet
				return `export default "";`;
			}
		},
	};
}

/**
 * Generate the code for the virtual module
 */
function generateVirtualModuleCode(
	files: ReturnType<typeof getCollectedFiles>,
	_opts: ReturnType<typeof resolveOptions>,
	config: ResolvedConfig,
): string {
	const imports: string[] = [];
	const toolRegistrations: string[] = [];
	const resourceRegistrations: string[] = [];
	const promptRegistrations: string[] = [];

	// Generate imports and registrations for tools
	for (const tool of files.tools) {
		const identifier = nameToIdentifier(tool.name.replace(/\//g, "_"));
		const importName = `tool_${identifier}`;
		imports.push(`import * as ${importName} from "${tool.path}";`);

		if (tool.hasApp) {
			// Tool with UI - use virtual module for HTML
			const htmlImportName = `${importName}_html`;
			imports.push(
				`import ${htmlImportName} from "${APP_HTML_PREFIX}${tool.name}";`,
			);
			toolRegistrations.push(
				generateAppToolRegistration(importName, htmlImportName),
			);
		} else {
			// Basic tool
			toolRegistrations.push(generateBasicToolRegistration(importName));
		}
	}

	// Generate imports and registrations for resources
	for (const resource of files.resources) {
		const identifier = nameToIdentifier(resource.name.replace(/\//g, "_"));
		const importName = `resource_${identifier}`;
		imports.push(`import * as ${importName} from "${resource.path}";`);
		resourceRegistrations.push(generateResourceRegistration(importName));
	}

	// Generate imports and registrations for prompts
	for (const prompt of files.prompts) {
		const identifier = nameToIdentifier(prompt.name.replace(/\//g, "_"));
		const importName = `prompt_${identifier}`;
		imports.push(`import * as ${importName} from "${prompt.path}";`);
		promptRegistrations.push(generatePromptRegistration(importName));
	}

	return `
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

${imports.join("\n")}

/**
 * Create a new MCP server instance with all registered tools, resources, and prompts.
 * Each call creates a fresh instance, which is needed for transports like StreamableHTTPTransport
 * that require a new server per request.
 */
export function createMcpServer() {
  const server = new McpServer({
    name: "chapplin-server",
    version: "1.0.0",
  });

  // Register tools
  ${toolRegistrations.join("\n  ")}

  // Register resources
  ${resourceRegistrations.join("\n  ")}

  // Register prompts
  ${promptRegistrations.join("\n  ")}

  return server;
}

export default createMcpServer;
`.trim();
}

/**
 * Generate registration code for a basic tool (no UI)
 */
function generateBasicToolRegistration(importName: string): string {
	return `server.registerTool(${importName}.name, ${importName}.config, ${importName}.handler);`;
}

/**
 * Generate registration code for a tool with UI
 */
function generateAppToolRegistration(
	importName: string,
	htmlImportName: string,
): string {
	return `
{
  const uri = \`ui://\${${importName}.name}/app.html\`;
  server.registerTool(
    ${importName}.name,
    {
      ...${importName}.config,
      _meta: {
        ...${importName}.config._meta,
        ui: { resourceUri: uri },
      },
    },
    ${importName}.handler
  );
  server.registerResource(
    ${importName}.name,
    uri,
    {
      description: ${importName}.config.description,
      mimeType: "${MCP_APP_MIME_TYPE}",
      _meta: { ui: ${importName}.appMeta ?? {} },
    },
    async () => ({
      contents: [{
        uri,
        mimeType: "${MCP_APP_MIME_TYPE}",
        text: ${htmlImportName},
      }],
    })
  );
}`;
}

/**
 * Generate registration code for a resource
 */
function generateResourceRegistration(importName: string): string {
	return `server.registerResource(${importName}.name, ${importName}.config.uri, ${importName}.config, ${importName}.handler);`;
}

/**
 * Generate registration code for a prompt
 */
function generatePromptRegistration(importName: string): string {
	return `server.registerPrompt(${importName}.name, ${importName}.config, ${importName}.handler);`;
}
