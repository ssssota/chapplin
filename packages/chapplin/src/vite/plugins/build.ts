import type { Plugin, ResolvedConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { bundleClient } from "../shared/client.js";
import type { Options } from "../types.js";
import { bundleEntry } from "./bundle-entry.js";
import { clientToolResolver } from "./client-tool-resolver.js";

const builtinPluginNames = new Set(["commonjs", "alias"]);

export function build(opts: Options): Plugin {
	const toolFiles = new Set<string>();
	let resolvedConfig: ResolvedConfig;
	const plugin = {
		name: "chapplin:build",
		apply: "build",
		config(config, _env) {
			return {
				...config,
				build: {
					...config.build,
					rollupOptions: { input: opts.entry ?? "./src/index.ts" },
					ssr: true,
					dynamicImportVarsOptions: { exclude: "**" },
				},
				ssr: {
					external: true,
					...config.ssr,
					noExternal: [/^chapplin(\/.+)?$/],
				},
			};
		},
		configResolved(config) {
			resolvedConfig = config;
		},
		buildStart(_options) {
			toolFiles.clear();
		},
		resolveId: {
			order: "pre",
			filter: { id: /^chapplin(\/tool)?$/ },
			handler(_source, importer, _options) {
				// List up all tool files imported in the build
				if (importer?.match(/\/src\/tools\//)) {
					toolFiles.add(importer);
				}
			},
		},
		async buildEnd(_error) {
			if (toolFiles.size === 0) return;

			const plugins = [
				clientToolResolver(opts),
				viteSingleFile(),
				...resolvedConfig.plugins.filter((p) => {
					if (p.name.startsWith("chapplin:")) return false;
					if (builtinPluginNames.has(p.name)) return false;
					if (p.name.startsWith("vite:")) return false;
					return true;
				}),
			];

			for (const file of toolFiles) {
				const code = await this.fs.readFile(file, { encoding: "utf8" });
				const [name, js] = await bundleClient({
					file,
					code,
					plugins: [...plugins, bundleEntry({ entry: file })],
				});
				this.emitFile({
					type: "prebuilt-chunk",
					code: js,
					fileName: `widgets/${name}.js`,
				});
			}
		},
	} satisfies Plugin;
	return plugin;
}
