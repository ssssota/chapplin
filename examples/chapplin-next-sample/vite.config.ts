import react from "@vitejs/plugin-react";
import { chapplin } from "chapplin-next/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		react(),
		chapplin({
			entry: "./src/index.ts",
			target: "react",
		}),
	],
	build: {
		rollupOptions: {
			external: [
				"@hono/mcp",
				"@hono/node-server",
				"@modelcontextprotocol/sdk/server/stdio.js",
				"hono",
			],
		},
	},
});
