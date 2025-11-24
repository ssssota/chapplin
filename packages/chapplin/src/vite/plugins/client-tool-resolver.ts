import type { Plugin, ResolvedConfig } from "vite";
import { resolveTarget } from "../shared/client.js";
import type { Options, Target } from "../types.js";

export function clientToolResolver(opts?: Options): Plugin {
	let resolvedConfig: ResolvedConfig;
	let target = opts?.target;

	return {
		name: "chapplin:client-tool-resolver",
		configResolved(config) {
			resolvedConfig = config;
		},
		resolveId: {
			order: "pre",
			filter: { id: /^chapplin\/tool$/ },
			async handler(source, importer, options) {
				if (options.ssr || source !== "chapplin/tool") return;

				if (!target) {
					target = await resolveTarget(resolvedConfig, this.fs, opts);
				}
				return this.resolve(
					`chapplin/tool-${target satisfies Target}`,
					importer,
					options,
				);
			},
		},
	};
}
