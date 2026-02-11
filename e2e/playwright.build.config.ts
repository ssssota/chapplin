import { defineConfig, devices } from "@playwright/test";

const fixture = process.env.E2E_FIXTURE;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:4173`;
const webServerCommand = [
	`pnpm -C fixtures/${fixture} build`,
	`pnpm -C fixtures/${fixture} start`,
].join(" && ");

export default defineConfig({
	testDir: "./specs",
	testMatch: ["**/build-server.spec.ts"],
	timeout: 120_000,
	expect: { timeout: 10_000 },
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	reporter: "list",
	use: {
		baseURL,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	webServer: {
		command: webServerCommand,
		url: `${baseURL}/health`,
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
