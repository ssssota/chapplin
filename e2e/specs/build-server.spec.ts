import { expect, test } from "@playwright/test";
import {
	callTool,
	listResources,
	listTools,
	readResource,
} from "../helpers/mcp-client.js";

const ENV_FILE_LABEL = "ENV_FILE";
const ENV_FILE_VALUE = "from-env-test";
const IMPORTED_CSS_BORDER = "border-top:7px solid rgb(15,118,110)";

test.describe("chapplin build server", () => {
	test("/health returns ok", async ({ request }) => {
		const response = await request.get("/health");
		expect(response.ok()).toBeTruthy();
		const body = await response.json();
		expect(body).toEqual({ status: "ok" });
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

	test("tool UI resource reads .env.test", async ({ baseURL }) => {
		if (!baseURL) {
			throw new Error("baseURL is not defined");
		}
		const resources = await listResources(baseURL);
		const appResource = resources.find(
			(resource) => resource.uri === "ui://get_todos/app.html",
		);
		expect(appResource).toBeTruthy();

		const resource = await readResource(baseURL, "ui://get_todos/app.html");
		const content = resource.contents.find(
			(item) => "text" in item && typeof item.text === "string",
		);
		if (!content || !("text" in content) || typeof content.text !== "string") {
			throw new Error("Resource content is not in expected format");
		}
		expect(content.text).toContain(ENV_FILE_LABEL);
		expect(content.text).toContain(ENV_FILE_VALUE);
	});

	test("tool UI resource includes imported CSS", async ({ baseURL }) => {
		if (!baseURL) {
			throw new Error("baseURL is not defined");
		}

		const resource = await readResource(baseURL, "ui://get_todos/app.html");
		const content = resource.contents.find(
			(item) => "text" in item && typeof item.text === "string",
		);
		if (!content || !("text" in content) || typeof content.text !== "string") {
			throw new Error("Resource content is not in expected format");
		}
		expect(content?.text).toContain(IMPORTED_CSS_BORDER);
	});
});
