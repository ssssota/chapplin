import { glob, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import type {
	CollectedFile,
	CollectedFiles,
	ResolvedOptions,
} from "../types.js";
import { pathToName } from "../utils.js";

type CollectionDirectories = Pick<
	ResolvedOptions,
	"toolsDir" | "resourcesDir" | "promptsDir"
>;

/** Regex patterns for detecting define* calls */
const DEFINE_TOOL_PATTERN = /\bdefineTool\b/;
const DEFINE_APP_PATTERN = /\bdefineApp\b/;
const DEFINE_RESOURCE_PATTERN = /\bdefineResource\b/;
const DEFINE_PROMPT_PATTERN = /\bdefinePrompt\b/;

/** Store for collection options and root (shared between plugins) */
let collectionContext: {
	root: string;
	opts: ResolvedOptions;
} | null = null;

/** Cached collected files (updated in buildStart) */
let cachedFiles: CollectedFiles | null = null;

/**
 * Plugin that collects tool/resource/prompt files
 */
export function fileCollector(opts: ResolvedOptions): Plugin {
	let config: ResolvedConfig;

	return {
		name: "chapplin:file-collector",
		configResolved(resolvedConfig) {
			config = resolvedConfig;
			collectionContext = {
				root: config.root,
				opts,
			};
		},
		async buildStart() {
			if (!collectionContext) return;

			const files = await collectFilesFromRoot(
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
export async function collectFilesFromRoot(
	root: string,
	directories: CollectionDirectories,
): Promise<CollectedFiles> {
	const [tools, resources, prompts] = await Promise.all([
		collectToolFiles(root, directories.toolsDir),
		collectResourceFiles(root, directories.resourcesDir),
		collectPromptFiles(root, directories.promptsDir),
	]);

	return { tools, resources, prompts };
}

/**
 * Collect files from tools directory
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

			// Check if file contains defineTool
			if (!DEFINE_TOOL_PATTERN.test(code)) continue;

			const name = pathToName(entry, "");
			const hasApp = DEFINE_APP_PATTERN.test(code);

			files.push({
				path: absolutePath,
				relativePath,
				name,
				hasApp,
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
 * Collect files from resources directory
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

			// Check if file contains defineResource
			if (!DEFINE_RESOURCE_PATTERN.test(code)) continue;

			const name = pathToName(entry, "");

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
 * Collect files from prompts directory
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

			// Check if file contains definePrompt
			if (!DEFINE_PROMPT_PATTERN.test(code)) continue;

			const name = pathToName(entry, "");

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
	const files = await collectFilesFromRoot(
		collectionContext.root,
		collectionContext.opts,
	);
	// Update cache
	cachedFiles = files;
	return files;
}
