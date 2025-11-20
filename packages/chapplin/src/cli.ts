import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as process from "node:process";
import { parseArgs } from "node:util";
import { build } from "rolldown";

if (import.meta.main) main();

type Target = "react" | "preact" | "hono";
const baseConditionNames = ["import", "browser", "default"];
const targets = {
	react: {
		jsxImportSource: "react",
		conditionNames: ["react", ...baseConditionNames],
	},
	preact: {
		jsxImportSource: "preact",
		conditionNames: ["preact", ...baseConditionNames],
	},
	hono: {
		jsxImportSource: "hono/jsx",
		conditionNames: ["hono", ...baseConditionNames],
	},
} as const satisfies Record<
	Target,
	{ jsxImportSource: string; conditionNames: string[] }
>;

async function main() {
	const args = parseArgs({
		allowPositionals: true,
		options: {
			react: { type: "boolean", default: false },
			preact: { type: "boolean", default: false },
			hono: { type: "boolean", default: false },
			tsconfig: { type: "string", default: "./tsconfig.json" },
		},
	});

	const entry = args.positionals[0];
	if (!entry) {
		console.error("Please provide an entry file.");
		process.exit(1);
	}
	const cwd = process.cwd();

	// clean up previous build
	await fs
		.rm(path.resolve(cwd, "dist"), { recursive: true, force: true })
		.catch(console.error);

	const jsxImportSource = await resolveJsxImportSource(args.values.tsconfig);
	const target = targets[resolveTarget(args.values, jsxImportSource)];
	const importSource = jsxImportSource ?? target.jsxImportSource;
	console.log(`Detected target framework: ${target}`);

	// bundle the entry file
	const res = await build({
		input: path.resolve(cwd, entry),
		platform: "node",
		treeshake: true,
		transform: { jsx: { importSource } },
	});
	// find all modules that export a tool definition
	const modules = Object.entries(res.output[0].modules).filter(
		([, mod]) =>
			mod.renderedExports.includes("default") &&
			mod.code?.includes("defineTool"),
	);
	if (modules.length === 0) return;

	const widgetsDir = path.resolve(cwd, "dist/widgets");
	await fs.mkdir(widgetsDir, { recursive: true });
	const baseHtml = await fs.readFile(path.resolve(cwd, "index.html"), "utf-8");
	const defaultOptions = {
		platform: "browser",
		treeshake: true,
		transform: { jsx: { importSource } },
		resolve: { conditionNames: target.conditionNames },
		output: { minify: true },
		write: false,
	} as const;
	for (const [id, mod] of modules) {
		// Naively extract tool ID from the source code
		const toolId = mod.code?.match(
			/defineTool[ \t\r\n]*\([ \t\r\n]*(['"`])(.+?)\1/s,
		)?.[2];
		if (!toolId) continue;
		console.log(`Building widget for tool: ${toolId} (${id})`);
		const js = await build({ ...defaultOptions, input: id });
		const html = baseHtml
			.split("<!--TOOL_SCRIPT-->")
			.join(`<script type="module">${js.output[0].code}</script>`);
		await fs.writeFile(
			path.resolve(widgetsDir, `${toolId}.js`),
			`export default ${JSON.stringify(html)};`,
		);
	}
}

function resolveTarget(
	flags: {
		react: boolean;
		preact: boolean;
		hono: boolean;
	},
	jsxImportSource?: string,
): Target {
	// Since TypeScript may not be used, prioritize flags for determination
	if (flags.react) return "react";
	if (flags.preact) return "preact";
	if (flags.hono) return "hono";

	if (jsxImportSource === "preact") return "preact";
	if (jsxImportSource?.startsWith("hono/jsx")) return "hono"; // hono/jsx or hono/jsx/dom
	return "react"; // default
}

async function resolveJsxImportSource(
	tsconfigPath: string,
): Promise<string | undefined> {
	try {
		// tsconfig allows comments and trailing commas,
		// so we need to do some manual parsing here
		const tsconfig = await fs.readFile(tsconfigPath, "utf-8");
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
