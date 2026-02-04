import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { styleText } from "node:util";
import { Hono } from "hono";
import type { Plugin, ViteDevServer } from "vite";
import { devApi } from "vite-plugin-dev-api";
import type { Options } from "../types.js";
import { resolveOptions } from "../utils.js";
import { app as apiApp } from "./api-app.js";

/** Dev server preview UI path */
const PREVIEW_PATH = "/__chapplin__";

/**
 * Resolve package root directory
 * Works both in source and built code
 */
function getPackageRoot(): string {
	const require = createRequire(import.meta.url);
	try {
		// Try to resolve package.json from chapplin-next package
		const packageJsonPath = require.resolve("chapplin-next/package.json");
		return dirname(packageJsonPath);
	} catch {
		// Fallback: find package.json by traversing up from current file
		let currentDir = dirname(fileURLToPath(import.meta.url));
		while (currentDir !== dirname(currentDir)) {
			try {
				const packageJsonPath = join(currentDir, "package.json");
				// Check if it's chapplin-next package
				const pkg = require(packageJsonPath);
				if (pkg.name === "chapplin-next") {
					return currentDir;
				}
			} catch {
				// Continue searching
			}
			currentDir = dirname(currentDir);
		}
		throw new Error("Could not find chapplin-next package root");
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
			// Apply cyan color to the entire URL, then make port bold
			const cyanUrl = styleText("cyan", previewUrl);
			const coloredUrl = colorUrl(cyanUrl);
			// eslint-disable-next-line no-console
			console.log(
				`  ${styleText("green", "➜")}  ${styleText("bold", "chapplin Preview")}: ${coloredUrl}`,
			);
		}
	};
}

/**
 * Plugin that provides dev server functionality
 */
export function devServer(opts: Options): Plugin[] {
	const resolvedOpts = resolveOptions(opts);
	let root: string;

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
					console.log(path, root);
					const resolvedPath = join(root, path);
					this.addWatchFile(resolvedPath);
					return [
						`import {init} from 'chapplin-next/client/${resolvedOpts.target}';`,
						`import {App} from '${resolvedPath}';`,
						`init(App);`,
					].join("\n");
				},
			},
			configureServer: {
				order: "pre",
				handler(server) {
					setupPreviewUrlLogging(server);

					server.middlewares.use(async (req, res, next) => {
						if (!req.url) return next();

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
							const toolFile = req.url.replace("/iframe/tools/", "");
							res.setHeader("content-type", "text/html");
							const toolPath = `/${resolvedOpts.toolsDir}/${toolFile}`;
							const script = await server.transformRequest(
								`${VIRTUAL_MODULE_PREFIX}${toolPath}`,
							);
							if (!script) {
								res.statusCode = 404;
								res.end("Tool not found");
								return;
							}
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
