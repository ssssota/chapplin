import {
	type ChildProcessByStdio,
	type ChildProcessWithoutNullStreams,
	spawn,
} from "node:child_process";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import type Stream from "node:stream";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

interface JsonRpcSuccessResult {
	jsonrpc: "2.0";
	id: number | string | null;
	result?: Record<string, unknown>;
	error?: { code: number; message: string };
}

async function parseJsonRpcResponse(
	response: Response,
): Promise<JsonRpcSuccessResult> {
	const contentType = response.headers.get("content-type") ?? "";
	if (contentType.includes("text/event-stream")) {
		const body = await response.text();
		const dataLine = body
			.split("\n")
			.find((line) => line.trimStart().startsWith("data:"));
		if (!dataLine) {
			throw new Error(`No SSE data line found in response: ${body}`);
		}
		const payload = dataLine.replace(/^data:\s*/, "");
		return JSON.parse(payload) as JsonRpcSuccessResult;
	}
	return (await response.json()) as JsonRpcSuccessResult;
}

async function getFreePort(): Promise<number> {
	return await new Promise((resolvePort, reject) => {
		const server = createServer();
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (!address || typeof address === "string") {
				server.close();
				reject(new Error("Failed to resolve free port"));
				return;
			}
			const port = address.port;
			server.close((err) => {
				if (err) {
					reject(err);
					return;
				}
				resolvePort(port);
			});
		});
		server.on("error", reject);
	});
}

async function waitUntilAvailable(
	url: string,
	process: ChildProcessByStdio<null, Stream.Readable, Stream.Readable>,
	stdoutBuffer: string[],
	stderrBuffer: string[],
	timeoutMs = 30_000,
): Promise<void> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		if (process.exitCode !== null) {
			const stdout = stdoutBuffer.join("");
			const stderr = stderrBuffer.join("");
			throw new Error(
				`Dev server exited early with code ${process.exitCode}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
			);
		}
		try {
			const res = await fetch(url);
			if (res.ok) return;
		} catch {
			// retry
		}
		await sleep(250);
	}
	const stdout = stdoutBuffer.join("");
	const stderr = stderrBuffer.join("");
	throw new Error(
		`Timed out waiting for ${url}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
	);
}

async function shutdownProcess(
	process: ChildProcessByStdio<null, Stream.Readable, Stream.Readable>,
): Promise<void> {
	if (process.exitCode !== null) return;

	process.kill("SIGTERM");
	for (let i = 0; i < 20; i += 1) {
		if (process.exitCode !== null) return;
		await sleep(100);
	}
	process.kill("SIGKILL");
}

describe.sequential("dev server e2e", () => {
	let port = 0;
	let baseUrl = "";
	let devProcess: ChildProcessByStdio<
		null,
		Stream.Readable,
		Stream.Readable
	> | null = null;
	const stdoutBuffer: string[] = [];
	const stderrBuffer: string[] = [];
	const repoRoot = resolve(
		dirname(fileURLToPath(import.meta.url)),
		"../../../../../",
	);

	beforeAll(async () => {
		port = await getFreePort();
		baseUrl = `http://127.0.0.1:${port}`;

		devProcess = spawn(
			"pnpm",
			[
				"--filter",
				"chapplin-sample",
				"run",
				"dev",
				"--port",
				String(port),
				"--strictPort",
				"--host",
				"127.0.0.1",
			],
			{
				cwd: repoRoot,
				stdio: ["ignore", "pipe", "pipe"],
			},
		);

		devProcess.stdout.on("data", (chunk) => {
			stdoutBuffer.push(chunk.toString());
		});
		devProcess.stderr.on("data", (chunk) => {
			stderrBuffer.push(chunk.toString());
		});

		await waitUntilAvailable(
			`${baseUrl}/__chapplin__/api/server/status`,
			devProcess,
			stdoutBuffer,
			stderrBuffer,
			45_000,
		);
	}, 60_000);

	afterAll(async () => {
		if (devProcess) {
			await shutdownProcess(devProcess);
		}
	});

	it("lists tools via MCP tools/list", async () => {
		const response = await fetch(`${baseUrl}/mcp`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "application/json, text/event-stream",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "tools/list",
				params: {},
			}),
		});

		expect(response.ok).toBe(true);
		const payload = await parseJsonRpcResponse(response);
		expect(payload.error).toBeUndefined();

		const tools = payload.result?.tools as Array<{ name: string }> | undefined;
		expect(tools?.map((tool) => tool.name)).toEqual(
			expect.arrayContaining(["get_todos", "get_weather"]),
		);
	});

	it("serves iframe content by tool name", async () => {
		const response = await fetch(`${baseUrl}/iframe/tools/get_todos`);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");

		const html = await response.text();
		expect(html.toLowerCase()).toContain("<!doctype html>");
	});

	it("keeps /__chapplin__/api/files for resources/prompts", async () => {
		const response = await fetch(`${baseUrl}/__chapplin__/api/files`);
		expect(response.status).toBe(200);

		const data = (await response.json()) as {
			tools: unknown[];
			resources: unknown[];
			prompts: unknown[];
		};
		expect(Array.isArray(data.resources)).toBe(true);
		expect(Array.isArray(data.prompts)).toBe(true);
		expect(data.resources.length).toBeGreaterThan(0);
		expect(data.prompts.length).toBeGreaterThan(0);
	});

	it("does not emit fatal startup errors", async () => {
		const stderr = stderrBuffer.join("");
		const stdout = stdoutBuffer.join("");
		expect(`${stdout}\n${stderr}`).not.toContain("EADDRINUSE");
	});
});
