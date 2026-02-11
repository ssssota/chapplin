import { expect, test } from "@playwright/test";
import { callTool, listTools } from "../helpers/mcp-client.js";

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

	test("dev-ui preview renders todo app", async ({ page }) => {
		await page.goto("/");

		const toolItem = page.locator("li", { hasText: "get_todos" });
		await toolItem.getByRole("button", { name: "[Preview]" }).click();

		await expect(
			page.getByRole("heading", { name: /Preview: get_todos/i }),
		).toBeVisible();

		const input = page.locator("#input");
		await input.fill(JSON.stringify({ filter: "all" }, null, 2));

		await page.getByRole("button", { name: "Run" }).click();

		const output = page.locator("#output");
		await expect
			.poll(async () => output.inputValue())
			.toMatch(/structuredContent/);

		const frame = page.frameLocator("#frame");
		await expect(frame.getByText("TODO リスト")).toBeVisible();
	});
});
