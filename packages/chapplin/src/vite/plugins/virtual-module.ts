import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps";
import type { Plugin } from "vite";
import {
	RESOLVED_VIRTUAL_MODULE_ID,
	VIRTUAL_MODULE_ID,
} from "../../constants.js";
import type { CollectedFiles, ResolvedOptions } from "../types.js";
import { nameToIdentifier } from "../utils.js";
import { getBuiltAppHtml } from "./client-build.js";
import { getCollectedFiles } from "./file-collector.js";

/** Virtual module prefix for app HTML */
const APP_HTML_PREFIX = "virtual:chapplin-app-html:";

/**
 * Plugin that provides the virtual module `chapplin:register`
 */
export function virtualModule(opts: ResolvedOptions): Plugin {
	return {
		name: "chapplin:virtual-module",
		resolveId: {
			filter: { id: new RegExp(`^(${VIRTUAL_MODULE_ID}|${APP_HTML_PREFIX})`) },
			handler(id) {
				if (id === VIRTUAL_MODULE_ID) {
					return RESOLVED_VIRTUAL_MODULE_ID;
				}
				// Resolve app HTML virtual modules
				if (id.startsWith(APP_HTML_PREFIX)) {
					return `\0${id}`;
				}
			},
		},
		load: {
			filter: {
				id: new RegExp(`^(\\x00${VIRTUAL_MODULE_ID}|\\x00${APP_HTML_PREFIX})`),
			},
			async handler(id) {
				if (id === RESOLVED_VIRTUAL_MODULE_ID) {
					const files = await getCollectedFiles();
					return generateVirtualModuleCode(files, opts);
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
		},
	};
}

/**
 * Generate the code for the virtual module
 */
function generateVirtualModuleCode(
	files: CollectedFiles,
	_opts: ResolvedOptions,
): string {
	const imports: string[] = [];
	const toolRegistrations: string[] = [];
	const resourceRegistrations: string[] = [];
	const promptRegistrations: string[] = [];

	// Generate imports and registrations for tools (defineTool / defineApp)
	for (const tool of files.tools) {
		const ns = `tool_${nameToIdentifier(tool.name.replace(/\//g, "_"))}`;
		imports.push(`import * as ${ns} from "${tool.path}";`);

		if (tool.hasApp) {
			const htmlImportName = `${ns}_html`;
			imports.push(
				`import ${htmlImportName} from "${APP_HTML_PREFIX}${tool.name}";`,
			);
			toolRegistrations.push(generateAppToolRegistration(ns, htmlImportName));
		} else {
			toolRegistrations.push(generateBasicToolRegistration(ns));
		}
	}

	// Generate imports and registrations for resources (defineResource)
	for (const resource of files.resources) {
		const ns = `resource_${nameToIdentifier(resource.name.replace(/\//g, "_"))}`;
		imports.push(`import * as ${ns} from "${resource.path}";`);
		resourceRegistrations.push(generateResourceRegistration(ns));
	}

	// Generate imports and registrations for prompts (definePrompt)
	for (const prompt of files.prompts) {
		const ns = `prompt_${nameToIdentifier(prompt.name.replace(/\//g, "_"))}`;
		imports.push(`import * as ${ns} from "${prompt.path}";`);
		promptRegistrations.push(generatePromptRegistration(ns));
	}

	const indent = (s: string) =>
		s
			.trim()
			.split("\n")
			.map((line) => `  ${line}`)
			.join("\n");
	const registrationBody = [
		"  // Register tools",
		...toolRegistrations.map(indent),
		"",
		"  // Register resources",
		...resourceRegistrations.map(indent),
		"",
		"  // Register prompts",
		...promptRegistrations.map(indent),
	].join("\n");

	return `
${imports.join("\n")}

/**
 * Register all tools, resources, and prompts from this project onto the given MCP server.
 * @param {import("@modelcontextprotocol/sdk/server/mcp.js").McpServer} server
 */
export function register(server) {
${registrationBody}
}
`.trim();
}

/**
 * Generate registration code for a basic tool (no UI)
 */
function generateBasicToolRegistration(ns: string): string {
	return `server.registerTool(${ns}.tool.name, ${ns}.tool.config, ${ns}.tool.handler);`;
}

/**
 * Generate registration code for a tool with UI (defineApp; app.meta used for _meta)
 */
function generateAppToolRegistration(
	ns: string,
	htmlImportName: string,
): string {
	return `
{
  const uri = \`ui://\${${ns}.tool.name}/app.html\`;
  server.registerTool(
    ${ns}.tool.name,
    {
      ...${ns}.tool.config,
      _meta: {
        ...${ns}.tool.config._meta,
        ui: { resourceUri: uri },
      },
    },
    ${ns}.tool.handler
  );
  server.registerResource(
    ${ns}.tool.name,
    uri,
    {
      description: ${ns}.tool.config.description,
      mimeType: "${RESOURCE_MIME_TYPE}",
      _meta: { ui: ${ns}.app.meta ?? {} },
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
function generateResourceRegistration(ns: string): string {
	return `server.registerResource(${ns}.resource.name, ${ns}.resource.config.uri, ${ns}.resource.config, ${ns}.resource.handler);`;
}

/**
 * Generate registration code for a prompt
 */
function generatePromptRegistration(ns: string): string {
	return `server.registerPrompt(${ns}.prompt.name, ${ns}.prompt.config, ${ns}.prompt.handler);`;
}
