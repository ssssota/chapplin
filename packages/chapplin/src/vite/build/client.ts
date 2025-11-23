import { parse } from "@babel/parser";
// @ts-expect-error
import babel_traverse from "@babel/traverse";
import MagicString from "magic-string";
import type { Plugin } from "vite";
import { transformWithEsbuild } from "vite";
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
			handler(code, _id, _options) {
				// Replace `defineTool(_, _, _, widget)` -> `defineTool(0, 0, 0, widget)`
				const parsed = parse(code, { sourceType: "module" });
				const m = new MagicString(code);

				let localName: string | null = null;
				babel_traverse.default(parsed, {
					// @ts-expect-error
					ImportDeclaration(path) {
						const source = path.node.source.value;
						if (source === "chapplin/tool" || source === "chapplin") {
							const specifiers = path.node.specifiers;
							for (const specifier of specifiers) {
								if (
									specifier.type === "ImportSpecifier" &&
									specifier.imported.type === "Identifier" &&
									specifier.imported.name === "defineTool"
								) {
									localName = specifier.local.name;
								}
							}
						}
					},
					// @ts-expect-error
					CallExpression(path) {
						if (
							localName !== null &&
							path.node.callee.type === "Identifier" &&
							path.node.callee.name === localName
						) {
							const args = path.node.arguments;
							const [first, _, third] = args;
							if (first === undefined || third === undefined) return;
							m.overwrite(first.start, third.end, "0, 0, 0");
						}
					},
				});

				return { code: m.toString(), map: m.generateMap() };
			},
		},
	};
}
