import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["./src/index.ts", "./src/vite/index.ts"],
	format: "esm",
	platform: "node",
	dts: true,
	tsconfig: "./tsconfig.json",
	outExtensions: () => ({
		js: ".js",
		dts: ".d.ts",
	}),
});
