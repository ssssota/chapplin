import type { Plugin } from "vite";
import { transformWithEsbuild } from "vite";
import type { Target } from "../types.js";

export function entryPlugin(opts: {
	entry: string;
	jsxImportSource: string;
}): Plugin {
	const id = "virtual:chapplin";
	const resolvedId = `\0${id}`;
	return {
		name: "chapplin:client-entry",
		resolveId: {
			filter: { id: new RegExp(`^${id}$`) },
			handler(source, _importer, _options) {
				if (source === id) return resolvedId;
			},
		},
		load: {
			filter: { id: new RegExp(`^${resolvedId}$`) },
			handler(id, _options) {
				if (id !== resolvedId) return;
				return this.fs.readFile(opts.entry, { encoding: "utf8" });
			},
		},
		transform: {
			filter: { id: new RegExp(`^${resolvedId}$`) },
			handler(code, id, _options) {
				if (id !== resolvedId) return;
				return transformWithEsbuild(code, id, {
					loader: "tsx",
					jsxImportSource: opts.jsxImportSource,
				});
			},
		},
	};
}

export function toolPlugin(opts: { target: Target }): Plugin {
	return {
		name: "chapplin:client-tool",
		resolveId: {
			order: "pre",
			filter: { id: /^chapplin\/tool$/ },
			handler(source, importer, options) {
				console.log({
					source,
					importer,
					options,
				});
				if (source === "chapplin/tool") {
					return this.resolve(
						`chapplin/tool-${opts.target}`,
						importer,
						options,
					);
				}
			},
		},
	};
}
