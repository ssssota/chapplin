import { glob } from "node:fs/promises";
import { relative, resolve } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import type { CollectedFile, CollectedFiles, Options } from "../types.js";
import { pathToName, resolveOptions } from "../utils.js";

/** Store for collected files (shared between plugins) */
const collectedFilesStore = new Map<string, CollectedFiles>();

/**
 * Plugin that collects tool/resource/prompt files
 */
export function fileCollector(opts: Options): Plugin {
	const resolvedOpts = resolveOptions(opts);
	let config: ResolvedConfig;
	let storeKey: string;

	return {
		name: "chapplin:file-collector",
		configResolved(resolvedConfig) {
			config = resolvedConfig;
			storeKey = config.root;
		},
		async buildStart() {
			const root = config.root;
			const collectedFiles = await collectFiles(root, resolvedOpts);
			collectedFilesStore.set(storeKey, collectedFiles);

			// Log collected files in dev mode
			if (config.command === "serve") {
				const total =
					collectedFiles.tools.length +
					collectedFiles.resources.length +
					collectedFiles.prompts.length;
				if (total > 0) {
					config.logger.info(
						`[chapplin] Collected ${collectedFiles.tools.length} tools, ` +
							`${collectedFiles.resources.length} resources, ` +
							`${collectedFiles.prompts.length} prompts`,
					);
				}
			}
		},
		buildEnd() {
			// Clean up store after build
			if (config.command === "build") {
				collectedFilesStore.delete(storeKey);
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
	} catch {
		// Directory doesn't exist, return empty array
	}

	return files;
}

/**
 * Get collected files from store
 */
export function getCollectedFiles(config: ResolvedConfig): CollectedFiles {
	return (
		collectedFilesStore.get(config.root) ?? {
			tools: [],
			resources: [],
			prompts: [],
		}
	);
}
