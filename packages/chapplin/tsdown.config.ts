import { defineConfig } from "tsdown";

const outExtensions = () => ({
	js: ".js",
	dts: ".d.ts",
});

export default defineConfig([
	{
		outDir: "dist/internal/openai",
		entry: "./src/internal/openai/*.ts",
		format: "esm",
		platform: "browser",
		dts: false,
		outExtensions,
	},
	{
		outDir: "dist/internal/mcp",
		entry: "./src/internal/mcp/*.ts",
		format: "esm",
		platform: "browser",
		dts: false,
		outExtensions,
	},
	{
		entry: ["./src/index.ts", "./src/tool.ts", "./src/vite/index.ts"],
		format: "esm",
		platform: "node",
		dts: true,
		tsconfig: "./tsconfig.lib.json",
		outExtensions,
	},
]);
