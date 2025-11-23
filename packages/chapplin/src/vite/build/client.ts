import type { Plugin } from "vite";
import { transformWithEsbuild } from "vite";
import { id, idRegex, resolvedId, resolvedIdRegex } from "../shared/client.js";

export function entryPlugin(opts: {
	entry: string;
	jsxImportSource: string;
}): Plugin {
	return {
		name: "chapplin:client-entry",
		resolveId: {
			filter: { id: idRegex },
			handler(source, _importer, _options) {
				if (source === id) return resolvedId;
			},
		},
		load: {
			filter: { id: resolvedIdRegex },
			handler(id, _options) {
				if (id !== resolvedId) return;
				return this.fs.readFile(opts.entry, { encoding: "utf8" });
			},
		},
		transform: {
			filter: { id: resolvedIdRegex },
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
