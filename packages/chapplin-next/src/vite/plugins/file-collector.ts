import { readFile } from "node:fs/promises";
import { glob } from "node:fs/promises";
import { relative, resolve } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import type { CollectedFile, CollectedFiles, Options } from "../types.js";
import { pathToName, resolveOptions } from "../utils.js";
import {
	parsePromptFile,
	parseResourceFile,
	parseToolFile,
} from "../parser.js";

/** Store for collection options and root (shared between plugins) */
let collectionContext: {
	root: string;
	opts: ReturnType<typeof resolveOptions>;
} | null = null;

/** Cached collected files (updated in buildStart) */
let cachedFiles: CollectedFiles | null = null;

/**
 * Plugin that collects tool/resource/prompt files
 */
export function fileCollector(opts: Options): Plugin {
	const resolvedOpts = resolveOptions(opts);
	let config: ResolvedConfig;

	return {
		name: "chapplin:file-collector",
		configResolved(resolvedConfig) {
			config = resolvedConfig;
			collectionContext = {
				root: config.root,
				opts: resolvedOpts,
			};
		},
		async buildStart() {
			if (!collectionContext) return;

			const files = await collectFiles(
				collectionContext.root,
				collectionContext.opts,
			);

			// Cache the collected files
			cachedFiles = files;

			// Log collected files in dev mode
			if (config.command === "serve") {
				const total =
					files.tools.length + files.resources.length + files.prompts.length;
				if (total > 0) {
					config.logger.info(
						`[chapplin] Collected ${files.tools.length} tools, ` +
							`${files.resources.length} resources, ` +
							`${files.prompts.length} prompts`,
					);
				}
			}
		},
	};
}

/**
 * Collect files from tools/resources/prompts directories
 */
async function collectFiles(
	root: string,
	opts: ReturnType<typeof resolveOptions>,
): Promise<CollectedFiles> {
	const [tools, resources, prompts] = await Promise.all([
		collectToolFiles(root, opts.toolsDir),
		collectResourceFiles(root, opts.resourcesDir),
		collectPromptFiles(root, opts.promptsDir),
	]);

	return { tools, resources, prompts };
}

/**
 * Collect files from tools directory (defineTool / defineApp format)
 */
async function collectToolFiles(
	root: string,
	dir: string,
): Promise<CollectedFile[]> {
	const fullDir = resolve(root, dir);
	const files: CollectedFile[] = [];

	try {
		for await (const entry of glob("**/*.{ts,tsx}", { cwd: fullDir })) {
			const absolutePath = resolve(fullDir, entry);
			const relativePath = relative(root, absolutePath);
			const code = await readFile(absolutePath, "utf-8");
			const parsed = await parseToolFile(absolutePath, code);

			if (!parsed.hasTool) continue;

			const name = parsed.name ?? pathToName(entry, "");
			files.push({
				path: absolutePath,
				relativePath,
				name,
				hasApp: parsed.hasApp,
			});
		}
	} catch (err) {
		if (process.env.NODE_ENV !== "production") {
			console.warn(
				`[chapplin] Failed to collect files from ${dir}:`,
				err instanceof Error ? err.message : err,
			);
		}
		return [];
	}

	return files;
}

/**
 * Collect files from resources directory (defineResource format)
 */
async function collectResourceFiles(
	root: string,
	dir: string,
): Promise<CollectedFile[]> {
	const fullDir = resolve(root, dir);
	const files: CollectedFile[] = [];

	try {
		for await (const entry of glob("**/*.ts", { cwd: fullDir })) {
			const absolutePath = resolve(fullDir, entry);
			const relativePath = relative(root, absolutePath);
			const code = await readFile(absolutePath, "utf-8");
			const parsed = await parseResourceFile(absolutePath, code);

			if (!parsed.hasResource) continue;

			const name = parsed.name ?? pathToName(entry, "");
			files.push({
				path: absolutePath,
				relativePath,
				name,
				hasApp: false,
			});
		}
	} catch (err) {
		if (process.env.NODE_ENV !== "production") {
			console.warn(
				`[chapplin] Failed to collect files from ${dir}:`,
				err instanceof Error ? err.message : err,
			);
		}
		return [];
	}

	return files;
}

/**
 * Collect files from prompts directory (definePrompt format)
 */
async function collectPromptFiles(
	root: string,
	dir: string,
): Promise<CollectedFile[]> {
	const fullDir = resolve(root, dir);
	const files: CollectedFile[] = [];

	try {
		for await (const entry of glob("**/*.ts", { cwd: fullDir })) {
			const absolutePath = resolve(fullDir, entry);
			const relativePath = relative(root, absolutePath);
			const code = await readFile(absolutePath, "utf-8");
			const parsed = await parsePromptFile(absolutePath, code);

			if (!parsed.hasPrompt) continue;

			const name = parsed.name ?? pathToName(entry, "");
			files.push({
				path: absolutePath,
				relativePath,
				name,
				hasApp: false,
			});
		}
	} catch (err) {
		if (process.env.NODE_ENV !== "production") {
			console.warn(
				`[chapplin] Failed to collect files from ${dir}:`,
				err instanceof Error ? err.message : err,
			);
		}
		return [];
	}

	return files;
}

/**
 * Get collected files (fetches fresh data each time)
 * Falls back to cached files if collectionContext is not ready
 */
export async function getCollectedFiles(): Promise<CollectedFiles> {
	if (!collectionContext) {
		// Return cached files if available, otherwise empty
		if (cachedFiles) {
			return cachedFiles;
		}
		// Log warning in development for debugging
		if (process.env.NODE_ENV !== "production") {
			console.warn(
				"[chapplin] collectionContext not initialized yet. Files will be empty.",
			);
		}
		return { tools: [], resources: [], prompts: [] };
	}
	// Fetch fresh data
	const files = await collectFiles(collectionContext.root, collectionContext.opts);
	// Update cache
	cachedFiles = files;
	return files;
}
