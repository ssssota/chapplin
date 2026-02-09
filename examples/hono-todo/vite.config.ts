import { chapplin } from "chapplin/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		chapplin({
			entry: "./src/index.ts",
			target: "hono",
		}),
	],
});
