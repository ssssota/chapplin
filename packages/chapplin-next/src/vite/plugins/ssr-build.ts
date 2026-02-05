import type { Plugin } from "vite";
import type { ResolvedOptions } from "../types.js";

/**
 * Plugin to configure SSR build settings
 *
 * Automatically sets `build.ssr` to the user-specified entry,
 * so users don't need to duplicate the entry path in vite.config.ts.
 */
export function ssrBuild(opts: ResolvedOptions): Plugin {
	return {
		name: "chapplin:ssr-build",
		config(_, { command }) {
			if (command === "build") {
				// build.ssr expects a single string entry
				// For multiple entries, use rollupOptions.input with build.ssr: true
				const ssrEntry = opts.entry.length === 1 ? opts.entry[0] : opts.entry;
				return {
					build: {
						ssr: ssrEntry,
					},
				};
			}
		},
	};
}
