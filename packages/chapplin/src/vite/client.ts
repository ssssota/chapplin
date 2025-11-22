import type { Plugin } from "vite";
import { transformWithEsbuild } from "vite";

type Options = {
	entry: string;
	jsxImportSource: string;
};
export function clientPlugin(opts: Options): Plugin {
	const id = "virtual:chapplin";
	const resolvedId = `\0${id}`;
	return {
		name: "chapplin:client",
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
