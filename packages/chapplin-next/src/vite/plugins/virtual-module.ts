import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps";
import type { Plugin } from "vite";
import {
	RESOLVED_VIRTUAL_MODULE_ID,
	VIRTUAL_MODULE_ID,
} from "../../constants.js";
import type { CollectedFiles, Options } from "../types.js";
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

	return {
		name: "chapplin:virtual-module",
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
				const files = await getCollectedFiles();
				return generateVirtualModuleCode(files, resolvedOpts);
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
	files: CollectedFiles,
	_opts: ReturnType<typeof resolveOptions>,
): string {
	const imports: string[] = [];
	const toolRegistrations: string[] = [];
	const resourceRegistrations: string[] = [];
	const promptRegistrations: string[] = [];

	// Generate imports and registrations for tools (defineTool / defineApp)
	for (const tool of files.tools) {
		const identifier = nameToIdentifier(tool.name.replace(/\//g, "_"));
		const toolVar = `tool_${identifier}`;

		if (tool.hasApp) {
			const appVar = `app_${identifier}`;
			imports.push(
				`import { tool as ${toolVar}, app as ${appVar} } from "${tool.path}";`,
			);
			const htmlImportName = `${toolVar}_html`;
			imports.push(
				`import ${htmlImportName} from "${APP_HTML_PREFIX}${tool.name}";`,
			);
			toolRegistrations.push(
				generateAppToolRegistration(toolVar, appVar, htmlImportName),
			);
		} else {
			imports.push(`import { tool as ${toolVar} } from "${tool.path}";`);
			toolRegistrations.push(generateBasicToolRegistration(toolVar));
		}
	}

	// Generate imports and registrations for resources (defineResource)
	for (const resource of files.resources) {
		const identifier = nameToIdentifier(resource.name.replace(/\//g, "_"));
		const importName = `resource_${identifier}`;
		imports.push(`import { resource as ${importName} } from "${resource.path}";`);
		resourceRegistrations.push(generateResourceRegistration(importName));
	}

	// Generate imports and registrations for prompts (definePrompt)
	for (const prompt of files.prompts) {
		const identifier = nameToIdentifier(prompt.name.replace(/\//g, "_"));
		const importName = `prompt_${identifier}`;
		imports.push(`import { prompt as ${importName} } from "${prompt.path}";`);
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
 * Generate registration code for a tool with UI (defineApp; app.meta used for _meta)
 */
function generateAppToolRegistration(
	toolVar: string,
	appVar: string,
	htmlImportName: string,
): string {
	return `
{
  const uri = \`ui://\${${toolVar}.name}/app.html\`;
  server.registerTool(
    ${toolVar}.name,
    {
      ...${toolVar}.config,
      _meta: {
        ...${toolVar}.config._meta,
        ui: { resourceUri: uri },
      },
    },
    ${toolVar}.handler
  );
  server.registerResource(
    ${toolVar}.name,
    uri,
    {
      description: ${toolVar}.config.description,
      mimeType: "${RESOURCE_MIME_TYPE}",
      _meta: { ui: ${appVar}.meta ?? {} },
    },
    async () => ({
      contents: [{
        uri,
        mimeType: "${RESOURCE_MIME_TYPE}",
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
