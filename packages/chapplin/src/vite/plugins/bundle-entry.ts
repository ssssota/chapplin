import type { Node } from "estree";
import MagicString from "magic-string";
import { parse } from "oxc-parser";
import type { Plugin } from "vite";
import { walk } from "zimmerframe";
import { id, idRegex } from "../shared/client.js";

type Options = {
	entry: string;
};
export function bundleEntry(opts: Options): Plugin {
	let resolvedId: string | undefined;

	return {
		name: "chapplin:bundle-entry",
		resolveId: {
			filter: { id: idRegex },
			async handler(source, _importer, _options) {
				if (source !== id) return;
				const resolved = await this.resolve(opts.entry, _importer, _options);
				resolvedId = resolved?.id;
				return resolved;
			},
		},

		transform: {
			// Run after esbuild transform (TSX -> Pure ESM)
			order: "post",
			async handler(code, id, _options) {
				if (id !== resolvedId) return;

				// Replace `defineTool(_, _, _, widget)` -> `defineTool(0, 0, 0, widget)` for minify
				const parsed = await parse(id, code, {
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
