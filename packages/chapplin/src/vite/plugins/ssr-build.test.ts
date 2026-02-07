import { describe, expect, it } from "vitest";
import type { ResolvedOptions } from "../types.js";
import { ssrBuild } from "./ssr-build.js";

function createMockOptions(
	overrides: Partial<ResolvedOptions> = {},
): ResolvedOptions {
	return {
		entry: "./src/index.ts",
		tsconfigPath: "tsconfig.json",
		target: "react",
		toolsDir: "tools",
		resourcesDir: "resources",
		promptsDir: "prompts",
		...overrides,
	};
}

describe("ssrBuild plugin", () => {
	it("should have correct plugin name", () => {
		const plugin = ssrBuild(createMockOptions());
		expect(plugin.name).toBe("chapplin:ssr-build");
	});

	it("should set build.ssr to entry in build mode", () => {
		const plugin = ssrBuild(createMockOptions({ entry: "./src/index.ts" }));

		const configHook = plugin.config as (
			config: unknown,
			env: { command: string },
		) => { build: { ssr: string } } | undefined;

		const result = configHook({}, { command: "build" });

		expect(result).toEqual({
			build: {
				ssr: "./src/index.ts",
			},
		});
	});

	it("should use custom entry path", () => {
		const plugin = ssrBuild(createMockOptions({ entry: "./custom/entry.ts" }));

		const configHook = plugin.config as (
			config: unknown,
			env: { command: string },
		) => { build: { ssr: string } } | undefined;

		const result = configHook({}, { command: "build" });

		expect(result).toEqual({
			build: {
				ssr: "./custom/entry.ts",
			},
		});
	});

	it("should return undefined in serve mode", () => {
		const plugin = ssrBuild(createMockOptions());

		const configHook = plugin.config as (
			config: unknown,
			env: { command: string },
		) => unknown;

		const result = configHook({}, { command: "serve" });

		expect(result).toBeUndefined();
	});
});
