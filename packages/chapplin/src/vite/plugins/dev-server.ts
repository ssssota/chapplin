import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { styleText } from "node:util";
import { Hono } from "hono";
import type { Plugin, ViteDevServer } from "vite";
import { devApi } from "vite-plugin-dev-api";
import { app as apiApp } from "./api-app.js";
import { createAppHtml, createDevAppEntrySrc } from "./app-entry.js";
import { parseToolPathFromDevIframePath } from "./dev-app-path.js";
import {
	type DevMcpServerInfo,
	getDevMcpServerInfo,
	handleDevMcpRequest,
} from "./dev-mcp-server.js";
import { getCollectedFiles } from "./file-collector.js";

/** Dev server preview UI path */
const PREVIEW_PATH = "/";
const API_BASE_PATH = "/api";

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
const DEV_UI_BUILD_DIR = join(PACKAGE_ROOT, "dist");

function getPathname(url: string): string {
	return url.split("?")[0] ?? url;
}

function isPreviewRootRequest(url: string): boolean {
	const pathname = getPathname(url);
	return pathname === PREVIEW_PATH || pathname === "/index.html";
}

function getToolPathFromCollectedFile(
	toolPathWithoutExt: string,
	file: string,
) {
	return `${toolPathWithoutExt}${extname(file)}`;
}

async function resolveToolFileByPath(toolPath: string) {
	const files = await getCollectedFiles();
	return (
		files.tools.find(
			(candidate) =>
				getToolPathFromCollectedFile(candidate.name, candidate.path) ===
				toolPath,
		) ?? null
	);
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
			const mcpUrl = `${serverUrl}/mcp`;
			// Apply cyan color to the entire URL, then make port bold
			const mcpColoredUrl = colorUrl(styleText("cyan", mcpUrl));
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
export function devServer(): Plugin[] {
	let serverInfo: DevMcpServerInfo;

	return [
		{
			...devApi({
				fetch: new Hono().route(API_BASE_PATH, apiApp).fetch,
				nextIf404: true,
			}),
			name: "chapplin:dev-api",
			apply: "serve",
		},
		{
			name: "chapplin:dev-server",
			apply: "serve",
			configResolved(config) {
				serverInfo = getDevMcpServerInfo(config.root);
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

						// Serve tool UI directly (for iframe)
						const toolPath = parseToolPathFromDevIframePath(req.url);
						if (toolPath) {
							const toolFile = await resolveToolFileByPath(toolPath);

							if (!toolFile) {
								res.statusCode = 404;
								res.end(`Tool not found: ${toolPath}`);
								return;
							}

							const html = await server.transformIndexHtml(
								req.url,
								createAppHtml({
									entrySrc: createDevAppEntrySrc(toolFile.path),
								}),
							);
							res.setHeader("content-type", "text/html");
							res.end(html);
							return;
						}

						const pathname = getPathname(req.url);
						if (
							pathname === API_BASE_PATH ||
							pathname.startsWith(`${API_BASE_PATH}/`)
						) {
							return next();
						}

						// Serve dev-ui SPA on root path
						if (isPreviewRootRequest(req.url)) {
							try {
								const html = await readFile(
									join(DEV_UI_BUILD_DIR, "index.html"),
									"utf-8",
								);
								res.setHeader("content-type", "text/html");
								res.end(html);
							} catch {
								res.statusCode = 404;
								res.end("Dev UI not found");
							}
							return;
						}

						next();
					});
				},
			},
		},
	];
}
