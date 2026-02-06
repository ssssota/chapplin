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
		apply: "build",
		config() {
			return {
				build: {
					ssr: opts.entry,
				},
			};
		},
	};
}
