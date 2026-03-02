import type { Plugin, ResolvedConfig } from "vite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CollectedFiles, ResolvedOptions } from "../types.js";
import { clientBuild, getBuiltAppHtml } from "./client-build.js";

const { mockViteBuild, mockGetCollectedFiles } = vi.hoisted(() => ({
	mockViteBuild: vi.fn(),
	mockGetCollectedFiles: vi.fn(),
}));

vi.mock("vite", () => ({
	build: mockViteBuild,
}));

vi.mock("./file-collector.js", () => ({
	getCollectedFiles: mockGetCollectedFiles,
}));

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

function createMockConfig(plugins: Plugin[] = []): ResolvedConfig {
	return {
		root: "/workspace",
		mode: "test",
		envPrefix: "VITE_",
		plugins,
	} as unknown as ResolvedConfig;
}

function createCollectedFiles(): CollectedFiles {
	return {
		tools: [
			{
				path: "/workspace/tools/alpha.tsx",
				relativePath: "tools/alpha.tsx",
				name: "alpha",
				hasApp: true,
			},
			{
				path: "/workspace/tools/beta.tsx",
				relativePath: "tools/beta.tsx",
				name: "beta",
				hasApp: true,
			},
		],
		resources: [],
		prompts: [],
	};
}

function createConcurrencyUnsafePlugin(): Plugin {
	let inUse = false;

	return {
		name: "test:concurrency-unsafe",
		async buildStart() {
			if (inUse) {
				throw new Error("plugin instance used concurrently");
			}
			inUse = true;
			await new Promise((resolve) => setTimeout(resolve, 10));
			inUse = false;
		},
	};
}

async function runBuildStartHooks(plugins: Plugin[]): Promise<void> {
	for (const plugin of plugins) {
		if (!plugin.buildStart) continue;
		if (typeof plugin.buildStart === "function") {
			await plugin.buildStart.call({} as never, {} as never);
			continue;
		}
		await plugin.buildStart.handler.call({} as never, {} as never);
	}
}

interface ClientBuildPluginHooks {
	configResolved?: (config: ResolvedConfig) => void | Promise<void>;
	buildStart?: () => void | Promise<void>;
	buildEnd?: () => void | Promise<void>;
}

describe("client-build plugin", () => {
	beforeEach(() => {
		mockViteBuild.mockReset();
		mockGetCollectedFiles.mockReset();
	});

	it("serializes lazy app builds to avoid concurrent plugin usage", async () => {
		const sharedPlugin = createConcurrencyUnsafePlugin();
		const plugin = clientBuild(createMockOptions());
		const hooks = plugin as unknown as ClientBuildPluginHooks;

		mockGetCollectedFiles.mockResolvedValue(createCollectedFiles());
		mockViteBuild.mockImplementation(async (buildConfig: unknown) => {
			const config = buildConfig as {
				plugins?: Plugin[];
				build?: {
					rollupOptions?: {
						input?: string;
					};
				};
			};
			await runBuildStartHooks(config.plugins ?? []);
			const input = config.build?.rollupOptions?.input ?? "unknown";
			return {
				output: [
					{
						type: "asset",
						fileName: "app.html",
						source: `<html>${input}</html>`,
					},
				],
			};
		});

		await hooks.configResolved?.(createMockConfig([sharedPlugin]));
		await hooks.buildStart?.();

		try {
			const [alphaHtml, betaHtml] = await Promise.all([
				getBuiltAppHtml("alpha"),
				getBuiltAppHtml("beta"),
			]);
			expect(alphaHtml).toContain("virtual:chapplin-app-entry.html");
			expect(betaHtml).toContain("virtual:chapplin-app-entry.html");
			expect(mockViteBuild).toHaveBeenCalledTimes(2);
		} finally {
			await hooks.buildEnd?.();
		}
	});
});
