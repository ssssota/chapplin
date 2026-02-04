import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["./src/index.ts", "./src/vite/index.ts", "./src/client/*.tsx"],
	format: "esm",
	platform: "node",
	dts: true,
	tsconfig: "./tsconfig.json",
	outExtensions: () => ({
		js: ".js",
		dts: ".d.ts",
	}),
});
