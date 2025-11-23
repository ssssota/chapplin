import type { Node } from "estree";
import MagicString from "magic-string";
import { parse } from "oxc-parser";
import type { Plugin } from "vite";
import { transformWithEsbuild } from "vite";
import { walk } from "zimmerframe";
import type { Target } from "../types.js";

const id = "virtual:chapplin";
const idRegex = /^virtual:chapplin$/;
const resolvedId = `\0${id}`;
const resolvedIdRegex = /^\0virtual:chapplin$/;

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

export function toolPlugin(opts: { target: Target }): Plugin {
	return {
		name: "chapplin:client-tool",
		resolveId: {
			order: "pre",
			filter: { id: /^chapplin\/tool$/ },
			handler(source, importer, options) {
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

export function minifySupportPlugin(): Plugin {
	return {
		name: "chapplin:client-minify-support",
		transform: {
			// Run after esbuild transform (TSX -> Pure ESM)
			order: "post",
			filter: { id: resolvedIdRegex },
			async handler(code, _id, _options) {
				// Replace `defineTool(_, _, _, widget)` -> `defineTool(0, 0, 0, widget)`
				const parsed = await parse(_id, code, {
					sourceType: "module",
					range: true,
				});
				const m = new MagicString(code);

				const state = {};
				walk(parsed.program as Node, state, {
					CallExpression(path) {
						if (
							path.callee.type === "Identifier" &&
							path.callee.name === "defineTool"
						) {
							const args = path.arguments;
							const [first, _, third] = args;
							if (first?.range === undefined || third?.range === undefined)
								return;
							m.overwrite(first.range[0], third.range[1], "0, 0, 0");
						}
					},
				});

				return { code: m.toString(), map: m.generateMap() };
			},
		},
	};
}
