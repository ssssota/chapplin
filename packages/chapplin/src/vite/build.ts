import type { PluginContext } from "rolldown";
import {
	build,
	type Plugin,
	type PluginOption,
	type ResolvedConfig,
} from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { clientPlugin } from "./client.js";
import type { Options, Target } from "./types.js";

const builtinPluginNames = new Set(["commonjs", "alias"]);

const baseConditionNames = ["import", "browser", "default"];
const targets = {
	react: {
		name: "React",
		jsxImportSource: "react",
		conditionNames: ["react", ...baseConditionNames],
	},
	preact: {
		name: "Preact",
		jsxImportSource: "preact",
		conditionNames: ["preact", ...baseConditionNames],
	},
	hono: {
		name: "Hono",
		jsxImportSource: "hono/jsx",
		conditionNames: ["hono", ...baseConditionNames],
	},
} as const satisfies Record<
	Target,
	{ name: string; jsxImportSource: string; conditionNames: string[] }
>;

export function chapplinBuild(opts: Options): Plugin {
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
					dynamicImportVarsOptions: {
						exclude: "**",
					},
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
				if (importer?.match(/\/src\/tools\//)) {
					toolFiles.add(importer);
				}
			},
		},
		async buildEnd(_error) {
			if (toolFiles.size === 0) return;

			const jsxImportSource = opts.target
				? targets[opts.target].jsxImportSource
				: (getJsxImportSourceFromResolvedConfig(resolvedConfig) ??
					(await getJsxImportSourceFromTsconfig(
						this.fs,
						opts.tsconfigPath ?? "tsconfig.json",
					)) ??
					"react");

			const target =
				opts.target || resolveTargetFromJsxImportSource(jsxImportSource);

			const plugins = [
				viteSingleFile(),
				...resolvedConfig.plugins.filter((p) => {
					if (p.name === "chapplin:build") return false;
					if (builtinPluginNames.has(p.name)) return false;
					if (p.name.startsWith("vite:")) return false;
					return true;
				}),
			];

			for (const file of toolFiles) {
				const code = await this.fs.readFile(file, { encoding: "utf8" });
				const [name, js] = await bundleClient({
					target,
					file,
					code,
					jsxImportSource,
					plugins,
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

type Context = {
	target: Target;
	file: string;
	code: string;
	jsxImportSource: string;
	plugins: PluginOption[];
};
async function bundleClient(context: Context): Promise<[string, string]> {
	const name = context.code.match(
		/defineTool[ \t\r\n]*\([ \t\r\n]*(['"`])(.+?)\1/,
	)?.[2];
	if (!name) {
		throw new Error(`Failed to extract tool name from ${context.file}`);
	}
	const result = await build({
		configFile: false,
		appType: "spa",
		plugins: [
			...context.plugins,
			clientPlugin({
				entry: context.file,
				jsxImportSource: context.jsxImportSource,
			}),
		],
		resolve: { conditions: targets[context.target].conditionNames },
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

function resolveTargetFromJsxImportSource(jsxImportSource: string): Target {
	if (jsxImportSource === "react") return "react";
	if (jsxImportSource === "preact") return "preact";
	if (jsxImportSource.startsWith("hono/jsx")) return "hono";
	return "react"; // Default to react
}
