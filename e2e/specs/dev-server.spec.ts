import { expect, test } from "@playwright/test";
import { callTool, listTools } from "../helpers/mcp-client.js";

const ENV_FILE_MARKER = "ENV_FILE: from-env-test";

test.describe("chapplin dev server", () => {
	test("/api/files returns collected files", async ({ request }) => {
		const response = await request.get("/api/files");
		expect(response.ok()).toBeTruthy();

		const body = await response.json();
		expect(body).toHaveProperty("tools");
		expect(body).toHaveProperty("resources");
		expect(body).toHaveProperty("prompts");
		expect(Array.isArray(body.tools)).toBe(true);
	});

	test("/mcp tools/list exposes sample tools", async ({ baseURL }) => {
		if (!baseURL) {
			throw new Error("baseURL is not defined");
		}
		const tools = await listTools(baseURL);
		const toolNames = tools.map((tool) => tool.name);
		expect(toolNames).toEqual(
			expect.arrayContaining(["get_todos", "get_weather"]),
		);
	});

	test("/mcp tools/call returns structuredContent", async ({ baseURL }) => {
		if (!baseURL) {
			throw new Error("baseURL is not defined");
		}
		const result = await callTool(baseURL, {
			name: "get_todos",
			arguments: { filter: "all" },
		});

		expect(result.structuredContent).toBeTruthy();
		if (Array.isArray(result.structuredContent?.todos)) {
			expect(result.structuredContent?.todos?.length).toBeGreaterThan(0);
		} else {
			throw new Error("structuredContent.todos is not an array");
		}
	});

	test("/iframe/tools/get_todos returns HTML", async ({ request }) => {
		const response = await request.get("/iframe/tools/get_todos");
		expect(response.ok()).toBeTruthy();

		const html = await response.text();
		expect(html).toContain('<div id="root"></div>');
	});

	test("/iframe/tools/get_todos app reads .env.test", async ({ page }) => {
		await page.goto("/iframe/tools/get_todos");
		await expect(page.getByText(ENV_FILE_MARKER)).toBeVisible();
	});

	test("dev-ui preview renders todo app", async ({ page }) => {
		await page.goto("/");

		const toolItem = page.locator("li", { hasText: "get_todos" });
		await toolItem.getByRole("button", { name: "[Preview]" }).click();

		await expect(
			page.getByRole("heading", { name: /Preview: get_todos/i }),
		).toBeVisible();

		const connecting = page.getByText("Connecting MCP host bridge...");
		await expect(connecting).toBeHidden();

		const frame = page.frameLocator("#frame");
		await expect(frame.getByText("読み込み中...")).toBeVisible();

		const input = page.locator("#input");
		await input.fill(JSON.stringify({ filter: "all" }, null, 2));

		await page.getByRole("button", { name: "Run" }).click();

		const output = page.locator("#output");
		await expect
			.poll(async () => output.inputValue())
			.toMatch(/structuredContent/);

		await expect(frame.getByText("読み込み中...")).toHaveCount(0);
		await expect(frame.getByText("牛乳を買う")).toBeVisible();
		await expect(frame.getByText("TODO リスト")).toBeVisible();
		await expect(frame.getByText(ENV_FILE_MARKER)).toBeVisible();
	});

	test("dev-ui shows preview only for UI tools", async ({ page }) => {
		await page.goto("/");

		const todosItem = page.locator("li", { hasText: "get_todos" });
		await expect(todosItem.getByText("App")).toBeVisible();
		await expect(
			todosItem.getByRole("button", { name: "[Preview]" }),
		).toBeVisible();

		const weatherItem = page.locator("li", { hasText: "get_weather" });
		await expect(weatherItem.getByText("App")).toHaveCount(0);
		await expect(
			weatherItem.getByRole("button", { name: "[Preview]" }),
		).toHaveCount(0);
	});

	test("dev-ui preview handles invalid input and recovers", async ({
		page,
	}) => {
		await page.goto("/");

		const toolItem = page.locator("li", { hasText: "get_todos" });
		await toolItem.getByRole("button", { name: "[Preview]" }).click();

		await expect(
			page.getByRole("heading", { name: /Preview: get_todos/i }),
		).toBeVisible();

		const connecting = page.getByText("Connecting MCP host bridge...");
		await expect(connecting).toBeHidden();

		const input = page.locator("#input");
		await input.fill("[]");

		await page.getByRole("button", { name: "Run" }).click();

		await expect(page.getByText("Input must be a JSON object")).toBeVisible();
		await expect(page.locator("#output")).toHaveValue("");

		await input.fill(JSON.stringify({ filter: "all" }, null, 2));
		await page.getByRole("button", { name: "Run" }).click();

		await expect(page.getByText("Input must be a JSON object")).toHaveCount(0);
		await expect
			.poll(async () => page.locator("#output").inputValue())
			.toMatch(/structuredContent/);

		const frame = page.frameLocator("#frame");
		await expect(frame.getByText("TODO リスト")).toBeVisible();
	});

	test("dev-ui displays resources and prompts", async ({ page }) => {
		await page.goto("/");

		await expect(page.getByRole("heading", { name: "Tools" })).toBeVisible();

		await page.getByRole("button", { name: "Resources" }).click();
		await expect(
			page.getByRole("heading", { name: "Resources" }),
		).toBeVisible();
		await expect(page.getByText("config")).toBeVisible();

		await page.getByRole("button", { name: "Prompts" }).click();
		await expect(page.getByRole("heading", { name: "Prompts" })).toBeVisible();
		await expect(page.getByText("code-review")).toBeVisible();
	});
});
