const DEV_APP_RESOURCE_HOST = "__chapplin__";
const DEV_APP_HTML_SUFFIX = "/app.html";
const DEV_IFRAME_PREFIX = "/iframe/tools/";

function normalizeSlashes(value: string): string {
	return value.replace(/\\/g, "/");
}

function encodePathSegments(value: string): string {
	return value
		.split("/")
		.filter(Boolean)
		.map((segment) => encodeURIComponent(segment))
		.join("/");
}

function decodePathSegments(value: string): string | null {
	const segments = value.split("/").filter(Boolean);
	if (segments.length === 0) return null;

	try {
		return segments.map((segment) => decodeURIComponent(segment)).join("/");
	} catch {
		return null;
	}
}

function hasUnsafeSegments(value: string): boolean {
	return value
		.split("/")
		.some((segment) => segment === "." || segment === "..");
}

export function normalizeDevToolPath(value: string): string {
	const normalized = normalizeSlashes(value).replace(/^\/+|\/+$/g, "");
	if (!normalized) {
		throw new Error("Tool path must not be empty");
	}
	if (hasUnsafeSegments(normalized)) {
		throw new Error(`Invalid tool path: ${value}`);
	}
	return normalized;
}

export function createDevToolUiResourceUri(toolPath: string): string {
	const normalized = normalizeDevToolPath(toolPath);
	const encodedPath = encodePathSegments(normalized);
	return `ui://${DEV_APP_RESOURCE_HOST}/${encodedPath}${DEV_APP_HTML_SUFFIX}`;
}

export function createDevIframePathFromToolPath(toolPath: string): string {
	const normalized = normalizeDevToolPath(toolPath);
	const encodedPath = encodePathSegments(normalized);
	return `${DEV_IFRAME_PREFIX}${encodedPath}${DEV_APP_HTML_SUFFIX}`;
}

export function parseToolPathFromDevToolUiResourceUri(
	resourceUri: string,
): string | null {
	try {
		const parsed = new URL(resourceUri);
		if (parsed.protocol !== "ui:") return null;
		if (parsed.hostname !== DEV_APP_RESOURCE_HOST) return null;
		if (!parsed.pathname.endsWith(DEV_APP_HTML_SUFFIX)) return null;

		const encodedToolPath = parsed.pathname.slice(
			1,
			-DEV_APP_HTML_SUFFIX.length,
		);
		const decoded = decodePathSegments(encodedToolPath);
		if (!decoded || hasUnsafeSegments(decoded)) return null;
		return decoded;
	} catch {
		return null;
	}
}

export function parseToolPathFromDevIframePath(url: string): string | null {
	const pathname = url.split("?")[0] ?? url;
	if (!pathname.startsWith(DEV_IFRAME_PREFIX)) return null;
	if (!pathname.endsWith(DEV_APP_HTML_SUFFIX)) return null;

	const encodedToolPath = pathname.slice(
		DEV_IFRAME_PREFIX.length,
		-DEV_APP_HTML_SUFFIX.length,
	);
	const decoded = decodePathSegments(encodedToolPath);
	if (!decoded || hasUnsafeSegments(decoded)) return null;
	return decoded;
}
