import preact from "@preact/preset-vite";
import unocss from "unocss/vite";
import { defineConfig } from "vite";
import { viteSingleFile as single } from "vite-plugin-singlefile";

// https://vite.dev/config/
export default defineConfig({
	plugins: [preact(), unocss(), single()],
	build: {
		outDir: "../dist",
		emptyOutDir: false,
	},
});
