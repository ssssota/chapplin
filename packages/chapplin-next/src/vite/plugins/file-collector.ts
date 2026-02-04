import { glob } from "node:fs/promises";
import { relative, resolve } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import type { CollectedFile, CollectedFiles, Options } from "../types.js";
import { pathToName, resolveOptions } from "../utils.js";

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
		collectFilesFromDir(root, opts.toolsDir, true),
		collectFilesFromDir(root, opts.resourcesDir, false),
		collectFilesFromDir(root, opts.promptsDir, false),
	]);

	return { tools, resources, prompts };
}

/**
 * Collect files from a single directory
 */
async function collectFilesFromDir(
	root: string,
	dir: string,
	checkForApp: boolean,
): Promise<CollectedFile[]> {
	const fullDir = resolve(root, dir);
	const pattern = checkForApp ? "**/*.{ts,tsx}" : "**/*.ts";
	const files: CollectedFile[] = [];

	try {
		for await (const entry of glob(pattern, { cwd: fullDir })) {
			const absolutePath = resolve(fullDir, entry);
			const relativePath = relative(root, absolutePath);
			const name = pathToName(entry, "");

			// TODO: Check if file has App export by parsing
			// For now, assume .tsx files have App
			const hasApp = checkForApp && entry.endsWith(".tsx");

			files.push({
				path: absolutePath,
				relativePath,
				name,
				hasApp,
			});
		}
	} catch (err) {
		// Directory doesn't exist or other error
		// Log error in development for debugging
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
