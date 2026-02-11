import { chapplin } from "chapplin/vite";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
	plugins: [
		solid({ ssr: true }),
		chapplin({ entry: "./src/index.ts", target: "solid" }),
	],
});
