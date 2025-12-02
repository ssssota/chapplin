import { chapplin } from "chapplin/vite";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
	plugins: [chapplin(), solid()],
});
