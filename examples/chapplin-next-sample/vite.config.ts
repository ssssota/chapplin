import react from "@vitejs/plugin-react";
import { chapplin } from "chapplin-next/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		chapplin({
			entry: "./src/index.ts",
			target: "react",
		}),
		react(),
	],
	build: {
		ssr: true,
		rollupOptions: {
			input: "./src/index.ts",
			output: {
				entryFileNames: "index.js",
			},
		},
	},
});
