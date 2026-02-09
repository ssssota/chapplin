import type { Plugin } from "vite";
import type { ResolvedOptions, Target } from "../types.js";

const APP_ENTRY_ID = "virtual:chapplin-app-entry";
const APP_ENTRY_HTML_ID = "virtual:chapplin-app-entry.html";
const SCRIPT_PLACEHOLDER = "<!--CHAPPLIN_APP_SCRIPT-->";

const APP_HTML_TEMPLATE = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <div id="root"></div>
  ${SCRIPT_PLACEHOLDER}
</body>
</html>`;

export function appEntry(opts: ResolvedOptions): Plugin[] {
	const defaultTarget = opts.target;
	return [
		{
			name: "chapplin:app-entry-js",
			resolveId: {
				filter: { id: new RegExp(`^${APP_ENTRY_ID}`) },
				handler(id) {
					return `\0${id}`;
				},
			},
			load: {
				filter: { id: new RegExp(`^\\0${APP_ENTRY_ID}`) },
				handler(id) {
					const entry = parseAppEntryId(id);
					if (!entry) return null;
					const normalizedFile = normalizePath(entry);
					this.addWatchFile(normalizedFile);
					return createAppEntryModule(normalizedFile, defaultTarget);
				},
			},
		},
		{
			name: "chapplin:app-entry-html",
			resolveId: {
				filter: { id: new RegExp(`^${APP_ENTRY_HTML_ID}`) },
				handler(id) {
					return `\0${id}`;
				},
			},
			load: {
				filter: { id: new RegExp(`^\\0${APP_ENTRY_HTML_ID}`) },
				handler(id) {
					const htmlEntry = parseAppEntryHtmlId(id.slice(1));
					if (!htmlEntry) return null;
					const entryId = createAppEntryId(htmlEntry);
					return createAppHtml({ entrySrc: entryId });
				},
			},
		},
	];
}

export function createAppEntryId(file: string): string {
	const params = new URLSearchParams();
	params.set("file", file);
	return `${APP_ENTRY_ID}?${params.toString()}`;
}

export function createAppEntryHtmlId(file: string): string {
	const params = new URLSearchParams();
	params.set("file", file);
	return `${APP_ENTRY_HTML_ID}?${params.toString()}&lang.html`;
}

export function createAppHtml({
	script,
	entrySrc,
}: {
	script?: string;
	entrySrc?: string;
}): string {
	if (script && entrySrc) {
		throw new Error("Provide either script or entrySrc, not both.");
	}
	if (script) {
		return APP_HTML_TEMPLATE.replace(
			SCRIPT_PLACEHOLDER,
			`<script type="module">${script}</script>`,
		);
	}
	if (entrySrc) {
		return APP_HTML_TEMPLATE.replace(
			SCRIPT_PLACEHOLDER,
			`<script type="module" src="${entrySrc}"></script>`,
		);
	}
	throw new Error("Either script or entrySrc is required.");
}

function parseAppEntryId(id: string): string | null {
	const cleaned = stripNullByte(id);
	if (!cleaned.startsWith(APP_ENTRY_ID)) return null;
	const query = cleaned.slice(APP_ENTRY_ID.length + 1);
	const params = new URLSearchParams(query);
	const file = params.get("file");
	return file;
}

function parseAppEntryHtmlId(id: string): string | null {
	const cleaned = stripNullByte(id);
	if (!cleaned.startsWith(APP_ENTRY_HTML_ID)) return null;
	const query = cleaned.slice(APP_ENTRY_HTML_ID.length + 1);
	const params = new URLSearchParams(query);
	const file = params.get("file");
	return file;
}

function stripNullByte(id: string): string {
	return id.startsWith("\0") ? id.slice(1) : id;
}

function normalizePath(file: string): string {
	return file.replace(/\\/g, "/");
}

function createAppEntryModule(file: string, target?: Target): string {
	const resolvedTarget = target ?? "react";
	return [
		`import { init } from "chapplin/client/${resolvedTarget}";`,
		`import { app } from "${file}";`,
		`init(app.ui, app.config);`,
	].join("\n");
}
