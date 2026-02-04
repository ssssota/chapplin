import {
	DEFAULT_PROMPTS_DIR,
	DEFAULT_RESOURCES_DIR,
	DEFAULT_TOOLS_DIR,
} from "../constants.js";
import type { Options, ResolvedOptions } from "./types.js";

/**
 * Resolve options with defaults
 */
export function resolveOptions(opts: Options): ResolvedOptions {
	const entry = opts.entry
		? Array.isArray(opts.entry)
			? opts.entry
			: [opts.entry]
		: ["./src/index.ts"];

	return {
		entry,
		tsconfigPath: opts.tsconfigPath ?? "tsconfig.json",
		target: opts.target,
		toolsDir: opts.toolsDir ?? DEFAULT_TOOLS_DIR,
		resourcesDir: opts.resourcesDir ?? DEFAULT_RESOURCES_DIR,
		promptsDir: opts.promptsDir ?? DEFAULT_PROMPTS_DIR,
	};
}

/**
 * Convert a file name to a valid identifier
 * e.g., "my-tool" -> "myTool", "get_weather" -> "getWeather"
 */
export function nameToIdentifier(name: string): string {
	return name
		.replace(/[-_](.)/g, (_, c) => c.toUpperCase())
		.replace(/^(.)/, (_, c) => c.toLowerCase());
}

/**
 * Convert a file path to a tool/resource/prompt name
 * e.g., "tools/weather.ts" -> "weather"
 * e.g., "tools/nested/deep.ts" -> "nested/deep"
 */
export function pathToName(filePath: string, baseDir: string): string {
	const relativePath = filePath
		.replace(new RegExp(`^${baseDir}/?`), "")
		.replace(/\.(ts|tsx)$/, "");
	return relativePath;
}
