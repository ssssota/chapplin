import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { styleText } from "node:util";
import { Hono } from "hono";
import { type Plugin, runnerImport, type ViteDevServer } from "vite";
import { devApi } from "vite-plugin-dev-api";
import type { ResolvedOptions } from "../types.js";
import { app as apiApp } from "./api-app.js";
import { getBuiltAppHtml } from "./client-build.js";
import {
	type DevMcpServerInfo,
	getDevMcpServerInfo,
	handleDevMcpRequest,
} from "./dev-mcp-server.js";
import { getCollectedFiles } from "./file-collector.js";

/** Dev server preview UI path */
const PREVIEW_PATH = "/__chapplin__";

/**
 * Resolve package root directory
 * Works both in source and built code
 */
function getPackageRoot(): string {
	const require = createRequire(import.meta.url);
	try {
		// Try to resolve package.json from chapplin package
		const packageJsonPath = require.resolve("chapplin/package.json");
		return dirname(packageJsonPath);
	} catch {
		// Fallback: find package.json by traversing up from current file
		let currentDir = dirname(fileURLToPath(import.meta.url));
		while (currentDir !== dirname(currentDir)) {
			try {
				const packageJsonPath = join(currentDir, "package.json");
				// Check if it's chapplin package
				const pkg = require(packageJsonPath);
				if (pkg.name === "chapplin") {
					return currentDir;
				}
			} catch {
				// Continue searching
			}
			currentDir = dirname(currentDir);
		}
		throw new Error("Could not find chapplin package root");
	}
}

const PACKAGE_ROOT = getPackageRoot();
const DEV_UI_SOURCE_DIR = join(PACKAGE_ROOT, "dev-ui");
const DEV_UI_BUILD_DIR = join(PACKAGE_ROOT, "dist", "dev-ui");

const SCRIPT_PLACEHOLDER = `/*SCRIPT_PLACEHOLDER*/`;
const IFRAME_HTML = `<!doctype html>
<html>
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
	<div id="root"></div>
	<script type="module">${SCRIPT_PLACEHOLDER}</script>
</body>
</html>`;

const VIRTUAL_MODULE_PREFIX = "virtual:chapplin-client";

type UnknownRecord = Record<string, unknown>;

interface ToolExportLike {
	name?: unknown;
}

function normalizeToolName(rawToolName: string): string {
	const withoutQuery = rawToolName.split("?")[0] ?? rawToolName;
	const decoded = decodeURIComponent(withoutQuery);
	return decoded.replace(/\.(?:tsx?|jsx?)$/, "");
}

async function resolveToolFileByIdentifier(
	toolIdentifier: string,
	root: string,
) {
	const files = await getCollectedFiles();
	const direct = files.tools.find(
		(candidate) => candidate.name === toolIdentifier,
	);
	if (direct) return direct;

	for (const candidate of files.tools) {
		try {
			const imported = await runnerImport<UnknownRecord>(candidate.path, {
				root,
				configFile: false,
			});
			const tool = imported.module.tool as ToolExportLike | undefined;
			if (typeof tool?.name === "string" && tool.name === toolIdentifier) {
				return candidate;
			}
		} catch {
			// ignore import errors during lookup and continue
		}
	}

	return null;
}

/**
 * Setup preview URL logging (inspired by UnoCSS Inspector)
 */
function setupPreviewUrlLogging(server: ViteDevServer) {
	const _printUrls = server.printUrls;
	const colorUrl = (url: string) => {
		// Color the entire URL cyan, and make the port number bold
		// styleText applies to the entire text, so we need to handle port separately
		return url.replace(/:(\d+)\//, (_, port) => {
			// Port number should be bold and cyan
			const boldPort = styleText(["bold", "cyan"], port);
			// Return the match with the port replaced
			return `:${boldPort}/`;
		});
	};

	server.printUrls = () => {
		_printUrls();
		for (const localUrl of server.resolvedUrls?.local ?? []) {
			// server.config.base will be normalized with leading and trailing slashes,
			// but localUrl might not have a trailing slash
			const appUrl = localUrl.endsWith("/") ? localUrl : `${localUrl}/`;
			// remove the base path from appUrl if possible
			const serverUrl =
				server.config.base && appUrl.endsWith(server.config.base)
					? appUrl.slice(0, -server.config.base.length)
					: appUrl.slice(0, -1); // remove the trailing slash
			// we removed the trailing slash from serverUrl when removing the base, add it back
			const previewUrl = `${serverUrl}${PREVIEW_PATH}/`;
			const mcpUrl = `${serverUrl}/mcp`;
			// Apply cyan color to the entire URL, then make port bold
			const previewColoredUrl = colorUrl(styleText("cyan", previewUrl));
			const mcpColoredUrl = colorUrl(styleText("cyan", mcpUrl));
			// Preview URL
			console.log(
				`  ${styleText("green", "➜")}  ${styleText("bold", "chapplin Preview")}: ${previewColoredUrl}`,
			);
			// MCP URL
			console.log(
				`  ${styleText("green", "➜")}  ${styleText("bold", "chapplin MCP")}: ${mcpColoredUrl}`,
			);
		}
	};
}

/**
 * Plugin that provides dev server functionality
 */
export function devServer(opts: ResolvedOptions): Plugin[] {
	let root: string;
	let serverInfo: DevMcpServerInfo;

	return [
		{
			...devApi({
				fetch: new Hono().route("/__chapplin__/api", apiApp).fetch,
				nextIf404: true,
			}),
			name: "chapplin:dev-api",
			apply: "serve",
		},
		{
			name: "chapplin:dev-server",
			apply: "serve",
			configResolved(config) {
				root = config.root;
				serverInfo = getDevMcpServerInfo(root);
			},
			resolveId: {
				order: "pre",
				filter: { id: new RegExp(`^${VIRTUAL_MODULE_PREFIX}/`) },
				handler(id) {
					return `\0${id}`;
				},
			},
			load: {
				order: "pre",
				filter: { id: new RegExp(`^\\0${VIRTUAL_MODULE_PREFIX}/`) },
				async handler(id) {
					const path = id.replace(
						new RegExp(`^\\0${VIRTUAL_MODULE_PREFIX}/`),
						"",
					);
					const resolvedPath = join(root, path);
					this.addWatchFile(resolvedPath);
					return [
						`import { init } from 'chapplin/client/${opts.target}';`,
						`import { app } from '${resolvedPath}';`,
						`init(app.ui);`,
					].join("\n");
				},
			},
			configureServer: {
				order: "pre",
				handler(server) {
					setupPreviewUrlLogging(server);

					server.middlewares.use(async (req, res, next) => {
						if (!req.url) return next();

						// Serve MCP endpoint in dev mode
						if (await handleDevMcpRequest(server, req, res, serverInfo)) {
							return;
						}

						// Serve dev-ui SPA
						if (req.url.startsWith(PREVIEW_PATH)) {
							const originalUrl = req.url;

							// Skip API paths (handled by vite-plugin-dev-api)
							if (req.url.startsWith(`${PREVIEW_PATH}/api/`)) {
								return next();
							}

							// For all paths, serve built index.html (vite-plugin-singlefile inlines everything)
							// Fallback to source if not built
							try {
								let html: string;
								try {
									// Try to serve built HTML
									html = await readFile(
										join(DEV_UI_BUILD_DIR, "index.html"),
										"utf-8",
									);
								} catch {
									// Fallback to source if build doesn't exist
									if (
										originalUrl === PREVIEW_PATH ||
										originalUrl === `${PREVIEW_PATH}/`
									) {
										html = await readFile(
											join(DEV_UI_SOURCE_DIR, "index.html"),
											"utf-8",
										);
										// Transform HTML to inject Vite client and rewrite paths
										html = html.replace(/src\//g, `${PREVIEW_PATH}/src/`);
										html = await server.transformIndexHtml(req.url, html);
									} else {
										// For other paths in source mode, rewrite to dev-ui directory
										req.url = originalUrl.replace(PREVIEW_PATH, "");
										next();
										return;
									}
								}
								res.setHeader("content-type", "text/html");
								res.end(html);
							} catch {
								res.statusCode = 404;
								res.end("Dev UI not found");
							}
							return;
						}

						// Serve tool UI directly (for iframe)
						if (req.url.startsWith("/iframe/tools/")) {
							const rawToolIdentifier = req.url.replace("/iframe/tools/", "");
							const toolIdentifier = normalizeToolName(rawToolIdentifier);
							const toolFile = await resolveToolFileByIdentifier(
								toolIdentifier,
								root,
							);

							if (!toolFile) {
								res.statusCode = 404;
								res.end(`Tool not found: ${toolIdentifier}`);
								return;
							}

							const builtHtml = await getBuiltAppHtml(toolFile.name);
							if (builtHtml) {
								res.setHeader("content-type", "text/html");
								res.end(builtHtml);
								return;
							}

							const toolPath = `/${toolFile.relativePath.replaceAll("\\", "/")}`;
							const script = await server.transformRequest(
								`${VIRTUAL_MODULE_PREFIX}${toolPath}`,
							);

							if (!script) {
								res.statusCode = 404;
								res.end(
									`Tool entry could not be transformed: ${toolIdentifier}`,
								);
								return;
							}

							res.setHeader("content-type", "text/html");
							res.end(IFRAME_HTML.replace(SCRIPT_PLACEHOLDER, script.code));
							return;
						}

						next();
					});
				},
			},
		},
	];
}
