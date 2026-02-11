import type { Plugin, PluginOption, ResolvedConfig } from "vite";
import { build as viteBuild } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import type { ResolvedOptions } from "../types.js";
import { appEntry, createAppEntryHtmlId } from "./app-entry.js";
import { getCollectedFiles } from "./file-collector.js";

/** Plugin names to exclude from client build */
const EXCLUDED_PLUGIN_NAMES = new Set(["commonjs", "alias"]);

/** Cache for built app HTML */
const builtAppHtmlCache = new Map<string, string>();

/** Pending builds */
const pendingBuilds = new Map<string, Promise<string>>();

/** Build context for lazy building */
let buildContext: {
	config: ResolvedConfig;
	opts: ResolvedOptions;
	plugins: PluginOption[];
} | null = null;

/**
 * Get built HTML for a tool (used by virtual-module.ts)
 * This builds on-demand if not already built
 */
export async function getBuiltAppHtml(
	toolName: string,
): Promise<string | null> {
	// Check cache first
	if (builtAppHtmlCache.has(toolName)) {
		return builtAppHtmlCache.get(toolName) || null;
	}
	// Check if build is pending
	if (pendingBuilds.has(toolName)) {
		return pendingBuilds.get(toolName) || null;
	}

	// Build on demand
	if (buildContext) {
		const files = await getCollectedFiles();
		const tool = files.tools.find((t) => t.name === toolName && t.hasApp);
		if (tool) {
			const buildPromise = buildClientApp({
				file: tool.path,
				name: tool.name,
				plugins: buildContext.plugins,
				opts: buildContext.opts,
			}).then(([, html]) => {
				builtAppHtmlCache.set(toolName, html);
				pendingBuilds.delete(toolName);
				return html;
			});

			pendingBuilds.set(toolName, buildPromise);
			return buildPromise;
		}
	}

	return null;
}

/**
 * Plugin that builds UI tools into single HTML files
 */
export function clientBuild(opts: ResolvedOptions): Plugin {
	let config: ResolvedConfig;

	return {
		name: "chapplin:client-build",
		configResolved(resolvedConfig) {
			config = resolvedConfig;
		},
		buildStart() {
			// Clear cache at build start
			builtAppHtmlCache.clear();
			pendingBuilds.clear();

			// Set up build context for lazy building
			buildContext = {
				config,
				opts,
				plugins: getClientBuildPlugins(config, opts),
			};
		},
		buildEnd() {
			// Clear build context
			buildContext = null;
		},
	};
}

/**
 * Get plugins for client build
 */
function getClientBuildPlugins(
	config: ResolvedConfig,
	_opts: ResolvedOptions,
): PluginOption[] {
	// Framework plugin prefixes to keep
	const KEEP_PREFIXES = [
		"vite:react", // React (vite:react-babel, vite:react-refresh, etc.)
		"vite:preact", // Preact
		"preact:",
		"solid", // Solid.js (vite-plugin-solid)
	];

	const plugins: PluginOption[] = [
		viteSingleFile(),
		// Filter plugins - keep framework plugins, filter out chapplin and internal vite plugins
		...config.plugins.filter((p) => {
			if (p.name.startsWith("chapplin:")) return false;
			// Keep framework plugins
			if (KEEP_PREFIXES.some((prefix) => p.name.startsWith(prefix)))
				return true;
			// Filter out other vite internal plugins
			if (p.name.startsWith("vite:")) return false;
			if (EXCLUDED_PLUGIN_NAMES.has(p.name)) return false;
			return true;
		}),
	];

	return plugins;
}

interface BuildContext {
	file: string;
	name: string;
	plugins: PluginOption[];
	opts: ResolvedOptions;
}

/**
 * Build a single MCP App into HTML
 */
async function buildClientApp(
	context: BuildContext,
): Promise<[string, string]> {
	// Determine JSX settings based on target
	const jsxConfig = getJsxConfig(context.opts.target);
	const htmlId = createAppEntryHtmlId(context.file);

	const result = await viteBuild({
		configFile: false,
		appType: "spa",
		esbuild: { jsxDev: false, ...jsxConfig },
		mode: "production",
		logLevel: "warn",
		plugins: [...appEntry(context.opts), ...context.plugins],
		build: { write: false, ssr: false, rollupOptions: { input: htmlId } },
	});

	if (Array.isArray(result)) {
		throw new Error("Multiple build results are not supported");
	}
	if (!("output" in result)) {
		throw new Error("No output found in build result");
	}

	const htmlAsset = result.output.find(
		(item) => item.type === "asset" && item.fileName.endsWith(".html"),
	);

	if (!htmlAsset || htmlAsset.type !== "asset") {
		throw new Error("No HTML asset found in build output");
	}

	const html = htmlAsset.source.toString();

	return [context.name, html];
}

/**
 * Get JSX configuration for esbuild based on target framework
 */
function getJsxConfig(target: string | undefined): {
	jsx?: "transform" | "preserve" | "automatic";
	jsxImportSource?: string;
	jsxFactory?: string;
	jsxFragment?: string;
} {
	switch (target) {
		case "react":
			return {
				jsx: "automatic",
				jsxImportSource: "react",
			};
		case "preact":
			return {
				jsx: "automatic",
				jsxImportSource: "preact",
			};
		case "solid":
			// Solid requires special handling - use solid-js/h
			return {
				jsx: "transform",
				jsxFactory: "h",
				jsxFragment: "Fragment",
			};
		case "hono":
			// Hono uses hono/jsx
			return {
				jsx: "automatic",
				jsxImportSource: "hono/jsx/dom",
			};
		default:
			return {};
	}
}
