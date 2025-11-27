import type { Plugin, ResolvedConfig } from "vite";
import type { Options, Target } from "../types.js";

type PluginContext = NonNullable<
	Plugin["load"]
> extends // biome-ignore lint/suspicious/noExplicitAny: for type inference
	| ((this: infer U, ...args: any[]) => any)
	// biome-ignore lint/suspicious/noExplicitAny: for type inference
	| { handler: (this: any, ...args: any[]) => any }
	? U
	: never;

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

async function resolveTarget(
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
