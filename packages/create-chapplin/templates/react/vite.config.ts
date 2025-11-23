import react from "@vitejs/plugin-react";
import { chapplin } from "chapplin/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [chapplin(), react()],
});
