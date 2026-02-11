import preact from "@preact/preset-vite";
import { chapplin } from "chapplin/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [preact(), chapplin({ entry: "./src/index.ts", target: "preact" })],
});
