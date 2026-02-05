/** UI framework target */
export type Target = "react" | "preact" | "hono" | "solid";

/** Vite plugin options */
export interface Options {
	/**
	 * Entry point file
	 * @default './src/index.ts'
	 */
	entry?: string | string[];

	/**
	 * Path to tsconfig.json
	 * @default 'tsconfig.json'
	 */
	tsconfigPath?: string;

	/**
	 * UI framework target
	 */
	target: Target;

	/**
	 * Directory containing tool files
	 * @default 'tools'
	 */
	toolsDir?: string;

	/**
	 * Directory containing resource files
	 * @default 'resources'
	 */
	resourcesDir?: string;

	/**
	 * Directory containing prompt files
	 * @default 'prompts'
	 */
	promptsDir?: string;
}

/** Resolved options with defaults applied */
export interface ResolvedOptions {
	entry: string[];
	tsconfigPath: string;
	target: Target;
	toolsDir: string;
	resourcesDir: string;
	promptsDir: string;
}

/** Collected file info */
export interface CollectedFile {
	/** Absolute file path */
	path: string;
	/** Relative path from project root */
	relativePath: string;
	/** File name without extension */
	name: string;
	/** Whether the file has an App export */
	hasApp: boolean;
}

/** Collected files by type */
export interface CollectedFiles {
	tools: CollectedFile[];
	resources: CollectedFile[];
	prompts: CollectedFile[];
}
