import { expect, type FrameLocator, type Page, test } from "@playwright/test";
import { callTool, listTools } from "../helpers/mcp-client.js";

const ENV_FILE_MARKER = "ENV_FILE: from-env-test";
const HOST_CONTEXT_EXPECTED = {
	locale: "en-US-x-host",
	theme: "dark",
	displayMode: "fullscreen",
	platform: "desktop",
	toolName: "get_todos",
} as const;

async function setHostContext(
	page: Page,
	context: {
		locale: string;
		theme: "light" | "dark";
		displayMode: "inline" | "fullscreen" | "pip";
		platform: "web" | "desktop" | "mobile";
	},
) {
	await page.getByTestId("host-context-toggle").click();
	const localeInput = page.getByTestId("host-context-locale");
	await expect(localeInput).toBeVisible();
	await localeInput.fill(context.locale);
	await page.getByTestId("host-context-theme").selectOption(context.theme);
	await page
		.getByTestId("host-context-display-mode")
		.selectOption(context.displayMode);
	await page
		.getByTestId("host-context-platform")
		.selectOption(context.platform);
	await page.getByTestId("host-context-close").click();
	await expect(page.getByTestId("host-context-locale")).toHaveCount(0);
}

async function expectHostContextValues(
	frame: FrameLocator,
	context: {
		locale: string;
		theme: string;
		displayMode: string;
		platform: string;
		toolName: string;
	},
) {
	await expect
		.poll(
			async () => ({
				theme:
					(
						await frame.getByTestId("app-host-context-theme").textContent()
					)?.trim() ?? "",
				locale:
					(
						await frame.getByTestId("app-host-context-locale").textContent()
					)?.trim() ?? "",
				displayMode:
					(
						await frame
							.getByTestId("app-host-context-display-mode")
							.textContent()
					)?.trim() ?? "",
				platform:
					(
						await frame.getByTestId("app-host-context-platform").textContent()
					)?.trim() ?? "",
				toolName:
					(
						await frame.getByTestId("app-host-context-tool-name").textContent()
					)?.trim() ?? "",
			}),
			{ timeout: 20_000 },
		)
		.toEqual({
			theme: context.theme,
			locale: context.locale,
			displayMode: context.displayMode,
			platform: context.platform,
			toolName: context.toolName,
		});
}

async function expectHostContextToolName(
	frame: FrameLocator,
	toolName: string,
) {
	await expect
		.poll(
			async () =>
				(
					await frame.getByTestId("app-host-context-tool-name").textContent()
				)?.trim() ?? "",
			{ timeout: 20_000 },
		)
		.toBe(toolName);
}

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

	test("/iframe/tools/todos.tsx/app.html returns HTML", async ({ request }) => {
		const response = await request.get("/iframe/tools/todos.tsx/app.html");
		expect(response.ok()).toBeTruthy();
		expect(response.headers()["content-security-policy"]).toContain(
			"connect-src 'self' ws: wss:",
		);

		const html = await response.text();
		expect(html).toContain('<div id="root"></div>');
	});

	test("/iframe/tools/todos.tsx/app.html app reads .env.test", async ({
		page,
	}) => {
		await page.goto("/iframe/tools/todos.tsx/app.html");
		await expect(page.getByText(ENV_FILE_MARKER)).toBeVisible();
	});

	test("/iframe/tools/todos.tsx/app.html applies imported CSS", async ({
		page,
	}) => {
		await page.goto("/iframe/tools/todos.tsx/app.html");
		const root = page.locator(".todos-view");
		await expect(root).toBeVisible();
		await expect
			.poll(async () =>
				root.evaluate((el) => {
					const style = window.getComputedStyle(el);
					return `${style.borderTopWidth}|${style.borderTopStyle}|${style.borderTopColor}`;
				}),
			)
			.toBe("7px|solid|rgb(15, 118, 110)");
	});

	test("/iframe/tools/todos.tsx/app.html blocks external image by CSP", async ({
		page,
	}) => {
		type WindowWithCSP = typeof window & {
			__cspViolations?: Array<{ directive: string; blockedURI: string }>;
		};
		await page.addInitScript(() => {
			const w = window as WindowWithCSP;
			w.__cspViolations = [];
			document.addEventListener("securitypolicyviolation", (event) => {
				w.__cspViolations?.push({
					directive: event.violatedDirective,
					blockedURI: event.blockedURI,
				});
			});
		});

		await page.goto("/iframe/tools/todos.tsx/app.html");
		await expect(page.getByTestId("csp-blocked-image")).toBeVisible();
		await expect
			.poll(async () =>
				page.evaluate(() => {
					const w = window as WindowWithCSP;
					return w.__cspViolations ?? [];
				}),
			)
			.toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						directive: expect.stringMatching(/img-src/),
						blockedURI: expect.stringContaining("picsum.photos"),
					}),
				]),
			);
	});

	test("dev-ui preview renders todo app", async ({ page }) => {
		await page.goto("/");

		await page.getByTestId("tool-item-get_todos").click();

		await expect(page.getByTestId("preview-tool-name")).toBeVisible();
		await expect(page.getByTestId("preview-tool-name")).toContainText(
			"get_todos",
		);

		const connecting = page.getByText("Connecting MCP host bridge...");
		await expect(connecting).toBeHidden();
		await expect(page.locator("#frame")).toHaveAttribute(
			"sandbox",
			"allow-scripts allow-same-origin",
		);

		const frame = page.frameLocator("#frame");
		await expect(frame.getByText("読み込み中...")).toBeVisible();

		await page.getByTestId("tool-input-filter").selectOption('"all"');

		await page.getByTestId("preview-run").click();

		const output = page.locator("#output");
		await expect
			.poll(async () => output.inputValue())
			.toMatch(/structuredContent/);

		await expect(frame.getByText("読み込み中...")).toHaveCount(0);
		await expect(frame.getByText("牛乳を買う")).toBeVisible();
		await expect(frame.getByText("TODO リスト")).toBeVisible();
		await expect(frame.getByText(ENV_FILE_MARKER)).toBeVisible();
	});

	test("dev-ui marks UI tools and supports non-app tool execution", async ({
		page,
	}) => {
		await page.goto("/");

		const todosItem = page.getByTestId("tool-item-get_todos");
		await expect(todosItem.getByText("App")).toBeVisible();

		const weatherItem = page.getByTestId("tool-item-get_weather");
		await expect(weatherItem.getByText("App")).toHaveCount(0);

		await weatherItem.click();
		await expect(page.getByTestId("preview-no-app")).toBeVisible();

		await page.getByTestId("tool-input-city").fill("tokyo");
		await page.getByTestId("tool-input-unit").selectOption('"celsius"');
		await page.getByTestId("preview-run").click();
		await expect
			.poll(async () => page.locator("#output").inputValue())
			.toMatch(/temperature/);
	});

	test("dev-ui preview handles invalid input and recovers", async ({
		page,
	}) => {
		await page.goto("/");

		await page.getByTestId("tool-item-get_todos").click();

		await expect(page.getByTestId("preview-tool-name")).toBeVisible();

		const connecting = page.getByText("Connecting MCP host bridge...");
		await expect(connecting).toBeHidden();

		await page.getByTestId("tool-item-get_weather").click();
		await page.getByTestId("tool-input-city").fill("");

		await page.getByTestId("preview-run").click();

		await expect(page.getByTestId("preview-error")).toContainText(
			"'city' is required",
		);
		await expect(page.locator("#output")).toHaveValue("");

		await page.getByTestId("tool-input-city").fill("tokyo");
		await page.getByTestId("tool-input-unit").selectOption('"celsius"');
		await page.getByTestId("preview-run").click();

		await expect(page.getByTestId("preview-error")).toHaveCount(0);
		await expect
			.poll(async () => page.locator("#output").inputValue())
			.toMatch(/temperature/);
	});

	test("dev-ui displays resources and prompts", async ({ page }) => {
		await page.goto("/");

		await expect(page.getByRole("heading", { name: "Tools" })).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Resources" }),
		).toBeVisible();
		await expect(page.getByText("config")).toBeVisible();

		await expect(page.getByRole("heading", { name: "Prompts" })).toBeVisible();
		await expect(page.getByText("code-review")).toBeVisible();
	});

	test("dev-ui preview can call openLink via useApp", async ({ page }) => {
		await page.goto("/");

		await page.getByTestId("tool-item-get_todos").click();

		const connecting = page.getByText("Connecting MCP host bridge...");
		await expect(connecting).toBeHidden();

		const frame = page.frameLocator("#frame");
		const popupPromise = page.waitForEvent("popup");
		await frame.getByRole("button", { name: "Open docs" }).click();
		const popup = await popupPromise;

		await expect
			.poll(() => popup.url())
			.toBe("https://example.com/chapplin-useapp-e2e");
		await popup.close();
	});

	test("dev-ui theme toggle switches theme label", async ({ page }) => {
		await page.goto("/");
		await page.getByTestId("tool-item-get_todos").click();

		const toggle = page.getByTestId("theme-toggle");
		const before = (await toggle.textContent())?.trim() ?? "";
		expect(before === "Theme: light" || before === "Theme: dark").toBeTruthy();
		await toggle.click();
		const after = (await toggle.textContent())?.trim() ?? "";
		expect(after).not.toBe(before);
	});

	test("dev-ui host context update keeps input, output, and log state", async ({
		page,
	}) => {
		await page.goto("/");
		await page.getByTestId("tool-item-get_todos").click();

		const connecting = page.getByText("Connecting MCP host bridge...");
		await expect(connecting).toBeHidden();

		await page.getByTestId("tool-input-filter").selectOption('"all"');
		await page.getByTestId("preview-run").click();

		const output = page.locator("#output");
		await expect
			.poll(async () => output.inputValue())
			.toMatch(/structuredContent/);

		const outputBefore = await output.inputValue();
		const eventLog = page.getByTestId("preview-event-log");
		const eventLogBefore = await eventLog.innerText();

		await page.getByTestId("host-context-toggle").click();
		const localeInput = page.getByTestId("host-context-locale");
		const localeBefore = await localeInput.inputValue();
		const nextLocale = localeBefore === "ja-JP" ? "en-US" : "ja-JP";
		await localeInput.fill(nextLocale);

		await expect(page.getByTestId("tool-input-filter")).toHaveValue('"all"');
		await expect(output).toHaveValue(outputBefore);
		await expect(eventLog).toHaveText(eventLogBefore);
		await expect(connecting).toBeHidden();
	});

	test("dev-ui host context propagates to app props", async ({ page }) => {
		await page.goto("/");
		await page.getByTestId("tool-item-get_todos").click();
		await expect(page.getByText("Connecting MCP host bridge...")).toBeHidden();

		const frame = page.frameLocator("#frame");
		await expect(frame.getByText("TODO リスト")).toBeVisible();

		await setHostContext(page, HOST_CONTEXT_EXPECTED);
		await expectHostContextValues(frame, HOST_CONTEXT_EXPECTED);
	});

	test("dev-ui host context keeps values after reconnect and reload", async ({
		page,
	}) => {
		await page.goto("/");
		await page.getByTestId("tool-item-get_todos").click();
		await expect(page.getByText("Connecting MCP host bridge...")).toBeHidden();

		const frame = page.frameLocator("#frame");
		await expect(frame.getByText("TODO リスト")).toBeVisible();

		await setHostContext(page, HOST_CONTEXT_EXPECTED);
		await expectHostContextValues(frame, HOST_CONTEXT_EXPECTED);

		await page.getByTestId("preview-reconnect").click();
		await expect(page.getByText("Connecting MCP host bridge...")).toBeHidden();
		await expectHostContextValues(frame, HOST_CONTEXT_EXPECTED);

		await page.getByTestId("preview-reload").click();
		await expect(frame.getByText("TODO リスト")).toBeVisible();
		await page.getByTestId("preview-reconnect").click();
		await expect(page.getByText("Connecting MCP host bridge...")).toBeHidden();

		await page.getByTestId("host-context-toggle").click();
		const localeInput = page.getByTestId("host-context-locale");
		await expect(localeInput).toHaveValue(HOST_CONTEXT_EXPECTED.locale);
		await expect(page.getByTestId("host-context-theme")).toHaveValue(
			HOST_CONTEXT_EXPECTED.theme,
		);
		await expect(page.getByTestId("host-context-display-mode")).toHaveValue(
			HOST_CONTEXT_EXPECTED.displayMode,
		);
		await expect(page.getByTestId("host-context-platform")).toHaveValue(
			HOST_CONTEXT_EXPECTED.platform,
		);
		const resendLocale = `${HOST_CONTEXT_EXPECTED.locale}-resync`;
		await localeInput.fill(resendLocale);
		await localeInput.fill(HOST_CONTEXT_EXPECTED.locale);
		await page.getByTestId("host-context-close").click();
		await expect(page.getByTestId("host-context-locale")).toHaveCount(0);
		await page.getByTestId("preview-reconnect").click();
		await expect(page.getByText("Connecting MCP host bridge...")).toBeHidden();

		await expectHostContextValues(frame, HOST_CONTEXT_EXPECTED);
	});

	test("dev-ui host context toolInfo stays aligned with selected app tool", async ({
		page,
	}) => {
		await page.goto("/");
		await page.getByTestId("tool-item-get_todos").click();
		await expect(page.getByText("Connecting MCP host bridge...")).toBeHidden();
		await setHostContext(page, HOST_CONTEXT_EXPECTED);

		const frame = page.frameLocator("#frame");
		await expectHostContextToolName(frame, "get_todos");

		await page.getByTestId("tool-item-get_weather").click();
		await expect(page.getByTestId("preview-no-app")).toBeVisible();

		await page.getByTestId("tool-item-get_todos").click();
		await expect(page.getByText("Connecting MCP host bridge...")).toBeHidden();
		await setHostContext(page, HOST_CONTEXT_EXPECTED);
		await expectHostContextToolName(frame, "get_todos");
	});

	test("dev-ui host context popover supports outside click and escape", async ({
		page,
	}) => {
		await page.goto("/");

		const toggle = page.getByTestId("host-context-toggle");
		await toggle.click();
		await expect(page.getByTestId("host-context-locale")).toBeVisible();

		await page.click("text=Preview");
		await expect(page.getByTestId("host-context-locale")).toHaveCount(0);

		await toggle.click();
		await expect(page.getByTestId("host-context-locale")).toBeVisible();

		await page.getByTestId("host-context-locale").press("Escape");
		await expect(page.getByTestId("host-context-locale")).toHaveCount(0);
	});

	test("dev-ui preview controller reconnect and reload keep preview usable", async ({
		page,
	}) => {
		await page.goto("/");
		await page.getByTestId("tool-item-get_todos").click();

		const connecting = page.getByText("Connecting MCP host bridge...");
		await expect(connecting).toBeHidden();

		await page.getByTestId("preview-reconnect").click();
		await expect(connecting).toBeHidden();

		await page.getByTestId("preview-reload").click();

		const widthPreset = page.getByTestId("preview-width-preset");
		const widthValue = page.getByTestId("preview-width-value");
		await widthPreset.selectOption("390");
		await expect(widthValue).toHaveText("390px");

		const resizeHandle = page.getByTestId("preview-resize-handle");
		const handleBox = await resizeHandle.boundingBox();
		if (!handleBox) {
			throw new Error("Failed to resolve preview resize handle position");
		}
		await page.mouse.move(
			handleBox.x + handleBox.width / 2,
			handleBox.y + handleBox.height / 2,
		);
		await page.mouse.down();
		await page.mouse.move(
			handleBox.x + handleBox.width / 2 + 80,
			handleBox.y + handleBox.height / 2,
		);
		await page.mouse.up();
		await expect(widthValue).not.toHaveText("390px");

		const frame = page.frameLocator("#frame");
		await expect(frame.getByText("TODO リスト")).toBeVisible();

		await page.getByTestId("tool-input-filter").selectOption('"all"');
		await page.getByTestId("preview-run").click();
		await expect
			.poll(async () => page.locator("#output").inputValue())
			.toMatch(/structuredContent/);
	});
});
