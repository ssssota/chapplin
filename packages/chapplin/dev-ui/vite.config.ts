import preact from "@preact/preset-vite";
import unocss from "unocss/vite";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
	plugins: [preact(), unocss(), viteSingleFile()],
	base: "/",
	build: {
		outDir: "../dist/dev-ui",
		emptyOutDir: false,
	},
	// Note: API is handled by the dev-server plugin, not here
});
