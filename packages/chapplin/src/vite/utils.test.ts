import { describe, expect, it } from "vitest";
import { nameToIdentifier, pathToName, resolveOptions } from "./utils.js";

describe("resolveOptions", () => {
	it("should use default entry when not specified", () => {
		const result = resolveOptions({ target: "react" });
		expect(result.entry).toBe("./src/index.ts");
	});

	it("should use custom entry when specified", () => {
		const result = resolveOptions({ target: "react", entry: "./custom.ts" });
		expect(result.entry).toBe("./custom.ts");
	});

	it("should use default tsconfigPath when not specified", () => {
		const result = resolveOptions({ target: "react" });
		expect(result.tsconfigPath).toBe("tsconfig.json");
	});

	it("should use custom tsconfigPath when specified", () => {
		const result = resolveOptions({
			target: "react",
			tsconfigPath: "tsconfig.build.json",
		});
		expect(result.tsconfigPath).toBe("tsconfig.build.json");
	});

	it("should use default directories when not specified", () => {
		const result = resolveOptions({ target: "react" });
		expect(result.toolsDir).toBe("tools");
		expect(result.resourcesDir).toBe("resources");
		expect(result.promptsDir).toBe("prompts");
	});

	it("should use custom directories when specified", () => {
		const result = resolveOptions({
			target: "react",
			toolsDir: "src/tools",
			resourcesDir: "src/resources",
			promptsDir: "src/prompts",
		});
		expect(result.toolsDir).toBe("src/tools");
		expect(result.resourcesDir).toBe("src/resources");
		expect(result.promptsDir).toBe("src/prompts");
	});

	it("should pass through target", () => {
		expect(resolveOptions({ target: "react" }).target).toBe("react");
		expect(resolveOptions({ target: "preact" }).target).toBe("preact");
		expect(resolveOptions({ target: "solid" }).target).toBe("solid");
		expect(resolveOptions({ target: "hono" }).target).toBe("hono");
	});
});

describe("nameToIdentifier", () => {
	it("should convert kebab-case to camelCase", () => {
		expect(nameToIdentifier("my-tool")).toBe("myTool");
		expect(nameToIdentifier("get-weather-data")).toBe("getWeatherData");
	});

	it("should convert snake_case to camelCase", () => {
		expect(nameToIdentifier("my_tool")).toBe("myTool");
		expect(nameToIdentifier("get_weather_data")).toBe("getWeatherData");
	});

	it("should handle mixed separators", () => {
		expect(nameToIdentifier("my-tool_name")).toBe("myToolName");
	});

	it("should lowercase first character", () => {
		expect(nameToIdentifier("MyTool")).toBe("myTool");
		expect(nameToIdentifier("Tool")).toBe("tool");
	});

	it("should handle single word", () => {
		expect(nameToIdentifier("tool")).toBe("tool");
		expect(nameToIdentifier("Tool")).toBe("tool");
	});
});

describe("pathToName", () => {
	it("should remove base directory and extension", () => {
		expect(pathToName("tools/weather.ts", "tools")).toBe("weather");
		expect(pathToName("tools/weather.tsx", "tools")).toBe("weather");
	});

	it("should handle nested paths", () => {
		expect(pathToName("tools/nested/deep.ts", "tools")).toBe("nested/deep");
		expect(pathToName("tools/a/b/c.ts", "tools")).toBe("a/b/c");
	});

	it("should handle base directory with trailing slash", () => {
		expect(pathToName("tools/weather.ts", "tools/")).toBe("weather");
	});

	it("should handle empty base directory", () => {
		expect(pathToName("weather.ts", "")).toBe("weather");
		expect(pathToName("nested/weather.ts", "")).toBe("nested/weather");
	});
});
