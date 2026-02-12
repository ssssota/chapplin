import { defineConfig } from "tsdown";

const frameworks = ["react", "preact", "hono", "solid"] as const;

export default defineConfig({
	entry: [
		"./src/index.ts",
		"./src/vite/index.ts",
		"./src/cli.ts",
		...frameworks.flatMap(
			(fw) => [`./src/${fw}.ts`, `./src/client/${fw}.ts`] as const,
		),
	],
	format: "esm",
	dts: true,
	tsconfig: "./tsconfig.json",
	outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
});
