import { defineConfig } from "tsdown";
export default defineConfig([
	{
		entry: "./src/internal/*.ts",
		format: "esm",
		platform: "browser",
		dts: false,
		outExtensions: () => {
			return {
				js: ".js",
				dts: ".d.ts",
			};
		},
	},
	{
		entry: ["./src/index.ts", "./src/tool.ts", "./src/vite/index.ts"],
		format: "esm",
		platform: "node",
		dts: true,
		tsconfig: "./tsconfig.lib.json",
		outExtensions: () => {
			return {
				js: ".js",
				dts: ".d.ts",
			};
		},
	},
]);
