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
});
