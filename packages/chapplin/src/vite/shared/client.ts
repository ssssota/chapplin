import type { PluginContext } from "rolldown";
import type { Plugin, PluginOption, ResolvedConfig } from "vite";
import { build } from "vite";
import type { Options, Target } from "../types.js";

export const id = "/__virtual-chapplin";
export const idRegex = new RegExp(`^${id}$`);
export const resolvedId = `\0__virtual-chapplin`;
export const resolvedIdRegex = new RegExp(`^${resolvedId}$`);

export function toolResolverPlugin(opts?: {
	target?: Target;
	tsconfigPath?: string;
	apply?: Plugin["apply"];
}): Plugin {
	let resolvedConfig: ResolvedConfig;
	let target = opts?.target;

	return {
		name: "chapplin:client-tool",
		apply: opts?.apply,
		configResolved(config) {
			resolvedConfig = config;
		},
		resolveId: {
			order: "pre",
			filter: { id: /^chapplin\/tool$/ },
			async handler(source, importer, options) {
				if (source === "chapplin/tool") {
					if (!target) {
						target = await resolveTarget(resolvedConfig, this.fs, opts);
					}
					return this.resolve(
						`chapplin/tool-${target satisfies Target}`,
						importer,
						options,
					);
				}
			},
		},
	};
}

type Context = {
	file: string;
	code: string;
	plugins: PluginOption[];
};
export async function bundleClient(
	context: Context,
): Promise<[string, string]> {
	const name = context.code.match(
		/defineTool[ \t\r\n]*\([ \t\r\n]*(['"`])(.+?)\1/,
	)?.[2];
	if (!name) {
		throw new Error(`Failed to extract tool name from ${context.file}`);
	}
	const result = await build({
		configFile: false,
		appType: "spa",
		plugins: context.plugins,
		build: { write: false, ssr: false },
	});
	if (Array.isArray(result)) {
		throw new Error("Multiple build results are not supported yet.");
	}
	if (!("output" in result)) {
		throw new Error("No output found in build result.");
	}
	const html = result.output.find((item) => item.type === "asset");
	if (!html) throw new Error("No HTML asset found in build output.");
	const js = `export default ${JSON.stringify(html.source.toString())};`;
	return [name, js];
}

function getJsxImportSourceFromResolvedConfig(
	config: ResolvedConfig,
): string | undefined {
	const jsx = config.build?.rollupOptions?.jsx;
	if (typeof jsx !== "object") return;
	return jsx.importSource ?? undefined;
}

async function getJsxImportSourceFromTsconfig(
	fs: PluginContext["fs"],
	tsconfigPath: string,
): Promise<string | undefined> {
	try {
		// tsconfig allows comments and trailing commas,
		// so we need to do some manual parsing here
		const tsconfig = await fs.readFile(tsconfigPath, { encoding: "utf8" });
		const tsconfigLines = tsconfig
			.split("\n")
			.map((ln) => ln.trim())
			.filter((ln) => !ln.startsWith("//"));
		const jsxImportSource = tsconfigLines
			.find((ln) => ln.startsWith('"jsxImportSource"'))
			?.match(/"jsxImportSource"[ \t]*:[ \t]*"(.+?)"/)?.[1];
		return jsxImportSource;
	} catch {
		// noop
	}
}

function resolveTargetFromJsxImportSource(jsxImportSource: string): Target {
	if (jsxImportSource === "react") return "react";
	if (jsxImportSource === "preact") return "preact";
	if (jsxImportSource.startsWith("hono/jsx")) return "hono";
	return "react"; // Default to react
}

export async function resolveTarget(
	resolvedConfig: ResolvedConfig,
	fs: PluginContext["fs"],
	opts?: Pick<Options, "target" | "tsconfigPath">,
): Promise<Target> {
	if (opts?.target) return opts.target;

	const jsxImportSource =
		getJsxImportSourceFromResolvedConfig(resolvedConfig) ??
		(await getJsxImportSourceFromTsconfig(
			fs,
			opts?.tsconfigPath ?? "tsconfig.json",
		)) ??
		"react";

	return resolveTargetFromJsxImportSource(jsxImportSource);
}
