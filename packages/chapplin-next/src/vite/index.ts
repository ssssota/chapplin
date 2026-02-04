import type { Plugin } from "vite";
import { clientBuild } from "./plugins/client-build.js";
import { devServer } from "./plugins/dev-server.js";
import { fileCollector } from "./plugins/file-collector.js";
import { typeGeneration } from "./plugins/type-generation.js";
import { virtualModule } from "./plugins/virtual-module.js";
import type { Options } from "./types.js";

export type { Options, ResolvedOptions, Target } from "./types.js";

/**
 * Chapplin Vite plugin
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { defineConfig } from "vite";
 * import { chapplin } from "chapplin-next/vite";
 * import react from "@vitejs/plugin-react";
 *
 * export default defineConfig({
 *   plugins: [
 *     chapplin({
 *       entry: "./src/index.ts",
 *       target: "react",
 *     }),
 *     react(),
 *   ],
 * });
 * ```
 */
export function chapplin(opts: Options = {}): Plugin[] {
	return [
		fileCollector(opts),
		virtualModule(opts),
		clientBuild(opts),
		typeGeneration(opts),
		devServer(opts),
	];
}
