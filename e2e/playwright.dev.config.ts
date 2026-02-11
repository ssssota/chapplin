import { defineConfig, devices } from "@playwright/test";

const fixture = process.env.E2E_FIXTURE;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:5173`;
const webServerCommand = [`pnpm -C fixtures/${fixture} dev`].join(" && ");

export default defineConfig({
	testDir: "./specs",
	testMatch: ["**/dev-server.spec.ts"],
	timeout: 60_000,
	expect: { timeout: 10_000 },
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	reporter: "list",
	use: {
		baseURL,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	webServer: {
		command: webServerCommand,
		url: `${baseURL}/api/server/status`,
		reuseExistingServer: !process.env.CI,
		timeout: 20_000,
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
