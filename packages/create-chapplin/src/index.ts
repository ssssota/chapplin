#!/usr/bin/env node

/**
 * Inspired by [create-vite](https://www.npmjs.com/package/create-vite)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import * as prompts from "@clack/prompts";

main().catch(console.error);

async function main() {
	const args = parseArgs({
		options: {
			react: { type: "boolean", default: false },
			preact: { type: "boolean", default: false },
			hono: { type: "boolean", default: false },
			overwrite: { type: "boolean", default: false },
		},
		allowPositionals: true,
	});

	const interactive = process.stdin.isTTY;
	const cancel = () => prompts.cancel("Operation cancelled");
	const defaultTargetDir = "chapplin-project";
	const cwd = process.cwd();

	// 1. Get project name and target dir
	let targetDir = args.positionals[0];
	if (!targetDir) {
		if (interactive) {
			const projectName = await prompts.text({
				message: "Project name:",
				defaultValue: defaultTargetDir,
				placeholder: defaultTargetDir,
				validate: (value) => {
					return value === undefined ||
						value.length === 0 ||
						formatTargetDir(value).length > 0
						? undefined
						: "Invalid project name";
				},
			});
			if (prompts.isCancel(projectName)) return cancel();
			targetDir = formatTargetDir(projectName);
		} else {
			targetDir = defaultTargetDir;
		}
	}
	const root = path.join(cwd, targetDir);
	fs.mkdirSync(root, { recursive: true });

	// 2. Handle directory if exist and not empty
	if (fs.existsSync(targetDir) && !isEmpty(targetDir)) {
		let overwrite: "yes" | "no" | "ignore" | undefined = args.values.overwrite
			? "yes"
			: undefined;
		if (!overwrite) {
			if (interactive) {
				const res = await prompts.select({
					message:
						(targetDir === "."
							? "Current directory"
							: `Target directory "${targetDir}"`) +
						` is not empty. Please choose how to proceed:`,
					options: [
						{
							label: "Cancel operation",
							value: "no",
						},
						{
							label: "Remove existing files and continue",
							value: "yes",
						},
						{
							label: "Ignore files and continue",
							value: "ignore",
						},
					],
				});
				if (prompts.isCancel(res)) return cancel();
				overwrite = res;
			} else {
				overwrite = "no";
			}
		}

		switch (overwrite) {
			case "yes":
				emptyDir(targetDir);
				break;
			case "no":
				cancel();
				return;
		}
	}

	// 3. Get package name
	let packageName = path.basename(path.resolve(targetDir));
	if (!isValidPackageName(packageName)) {
		if (interactive) {
			const packageNameResult = await prompts.text({
				message: "Package name:",
				defaultValue: toValidPackageName(packageName),
				placeholder: toValidPackageName(packageName),
				validate(dir) {
					if (dir === undefined || !isValidPackageName(dir)) {
						return "Invalid package.json name";
					}
				},
			});
			if (prompts.isCancel(packageNameResult)) return cancel();
			packageName = packageNameResult;
		} else {
			packageName = toValidPackageName(packageName);
		}
	}

	// 4. Choose a framework and variant
	let template = resolveTemplate(args.values);
	if (!template) {
		if (interactive) {
			const framework = await prompts.select({
				message: "Select a framework:",
				options: [
					{ label: "React", value: "react" },
					{ label: "Preact", value: "preact" },
					{ label: "Hono", value: "hono" },
				],
			});
			if (prompts.isCancel(framework)) return cancel();
		}
	}
	template ||= "hono";

	const templateDir = path.resolve(
		fileURLToPath(import.meta.url),
		"../templates",
		template,
	);
	copyDir(templateDir, targetDir);

	let doneMessage = "";
	const cdProjectName = path.relative(process.cwd(), root);
	doneMessage += `Done. Now run:\n`;
	if (root !== cwd) {
		doneMessage += `\n  cd ${
			cdProjectName.includes(" ") ? `"${cdProjectName}"` : cdProjectName
		}`;
	}
	doneMessage += `\n  npm install`;
	doneMessage += `\n  npm run dev`;
	prompts.outro(doneMessage);
}

function formatTargetDir(targetDir: string) {
	return targetDir.trim().replace(/\/+$/g, "");
}

function isEmpty(path: string) {
	const files = fs.readdirSync(path);
	return files.length === 0 || (files.length === 1 && files[0] === ".git");
}

function emptyDir(dir: string) {
	if (!fs.existsSync(dir)) {
		return;
	}
	for (const file of fs.readdirSync(dir)) {
		if (file === ".git") {
			continue;
		}
		fs.rmSync(path.resolve(dir, file), { recursive: true, force: true });
	}
}

function isValidPackageName(projectName: string) {
	return /^(?:@[a-z\d\-*~][a-z\d\-*._~]*\/)?[a-z\d\-~][a-z\d\-._~]*$/.test(
		projectName,
	);
}

function toValidPackageName(projectName: string) {
	return projectName
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/^[._]/, "")
		.replace(/[^a-z\d\-~]+/g, "-");
}

function resolveTemplate(options: {
	react: boolean;
	preact: boolean;
	hono: boolean;
}): "react" | "preact" | "hono" | undefined {
	if (options.react) return "react";
	if (options.preact) return "preact";
	if (options.hono) return "hono";
	return undefined;
}

function copy(src: string, dest: string) {
	const stat = fs.statSync(src);
	if (stat.isDirectory()) {
		copyDir(src, dest);
	} else {
		fs.copyFileSync(src, dest);
	}
}

function copyDir(srcDir: string, destDir: string) {
	fs.mkdirSync(destDir, { recursive: true });
	for (const file of fs.readdirSync(srcDir)) {
		const srcFile = path.resolve(srcDir, file);
		const destFile = path.resolve(destDir, file);
		copy(srcFile, destFile);
	}
}
