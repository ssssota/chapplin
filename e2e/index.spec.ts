import { execSync, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import treeKill from "tree-kill";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const setupTimeout = 1 * 60 * 1000; // 1 minute
const projectPath = path.join(process.cwd(), "fixture");
const stdio = "inherit" as const;
beforeAll(() => {
	fs.rmSync(projectPath, { recursive: true, force: true });
	console.log("Creating Chapplin project in", projectPath);
	execSync("npx create-chapplin fixture --hono", { stdio });

	console.log("Use chapplin version from local packages");
	const pkgJsonPath = path.join(projectPath, "package.json");
	const source = fs.readFileSync(pkgJsonPath, "utf8");
	const pkg = JSON.parse(source);
	pkg.devDependencies.chapplin = `workspace:*`;
	fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2), "utf8");

	console.log("Installing dependencies in", projectPath);
	execSync("pnpm install --no-frozen-lockfile", { cwd: projectPath, stdio });
}, setupTimeout);

afterAll(() => {
	console.log("Cleaning up", projectPath);
	fs.rmSync(projectPath, { recursive: true, force: true });
	execSync("pnpm install --no-frozen-lockfile", { stdio });
});

describe("npm run dev", () => {
	let devProcess: ReturnType<typeof spawn>;
	beforeAll(() => {
		console.log("Starting dev server in", projectPath);
		devProcess = spawn("npm", ["run", "dev"], {
			cwd: projectPath,
			stdio: ["pipe", "inherit", "inherit"],
			shell: true,
		});
		// Give the server some time to start
		return sleep(5000);
	});
	afterAll(() => {
		devProcess.stdin?.write("q\n");
		if (devProcess.pid) treeKill(devProcess.pid, "SIGKILL");
		// Give some time to clean up
		return sleep(1000);
	});

	it.each([
		"/",
		"/__virtual-chapplin",
		"/tools/get.tsx",
		"/src/tools/get.tsx",
	])("should respond to %s", async (url) => {
		const response = await fetch(`http://localhost:5173${url}`);
		const text = await response.text();
		const hashReplaced = text
			.replace(
				/from "\/@fs\/.+?\/chapplin\/packages/g,
				'from "/@fs/PATH/chapplin/packages',
			)
			.replace(/fileName: "[^"]+"/g, 'fileName: "FILE"')
			.replace(/\?v=[0-9a-f]{8}/g, "?v=HASH");
		expect(hashReplaced).toMatchSnapshot();
	});
});

describe("npm run build", () => {
	beforeAll(() => {
		console.log("Building project in", projectPath);
		execSync("npm run build", { cwd: projectPath, stdio });
	});

	it("should create the expected files", () => {
		const expectedFiles = ["dist/index.js", "dist/widgets/get.js"];
		expectedFiles.forEach((file) => {
			const filePath = path.join(projectPath, file);
			expect(fs.existsSync(filePath)).toBe(true);
		});
	});

	it("should correctly build widget", async () => {
		const widgetPath = path.join(projectPath, "dist/widgets/get.js");
		const widgetModule = await import(
			path.relative(fileURLToPath(import.meta.url), widgetPath)
		);
		expect(widgetModule.default).toMatchSnapshot();
	});
});

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
