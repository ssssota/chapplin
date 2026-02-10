import {
	type DisplayMode,
	SET_GLOBALS_EVENT_TYPE,
	type OpenAiGlobals,
} from "./openai.js";

export type Preview = {
	toolInput?: Record<string, unknown>;
	toolOutput?: Record<string, unknown>;
	toolResponseMetadata?: Record<string, unknown>;
};

export type PreviewDefaults = {
	theme?: "light" | "dark";
	locale?: string;
	maxHeight?: number;
	displayMode?: DisplayMode;
};

const defaultPreviewGlobals: PreviewDefaults = {
	theme: "light",
	locale: "en-US",
	maxHeight: 600,
	displayMode: "inline",
};

/**
 * Check if running in development mode.
 * Returns false in production to prevent preview stubs from being used.
 */
function isDevMode(): boolean {
	try {
		// Vite injects import.meta.env.DEV
		// biome-ignore lint/suspicious/noExplicitAny: Vite-specific property
		return (import.meta as any).env?.DEV === true;
	} catch {
		// Fallback: assume production if import.meta.env is not available
		return false;
	}
}

/**
 * Initialize window.openai with preview data for local development.
 * Only initializes in development mode when preview data is provided
 * and window.openai is not already set by the host.
 */
export function initializePreview(
	preview?: Preview,
	defaults?: PreviewDefaults,
): void {
	// Only initialize preview in development mode
	if (!preview || window.openai || !isDevMode()) return;

	const config = { ...defaultPreviewGlobals, ...defaults };

	// Create a mutable state object for widgetState
	let widgetState: Record<string, unknown> | null = null;

	window.openai = {
		theme: config.theme ?? "light",
		userAgent: {
			device: { type: "desktop" },
			capabilities: { hover: true, touch: false },
		},
		locale: config.locale ?? "en-US",
		maxHeight: config.maxHeight ?? 600,
		displayMode: config.displayMode ?? "inline",
		safeArea: { insets: { top: 0, bottom: 0, left: 0, right: 0 } },
		toolInput: preview.toolInput ?? {},
		toolOutput: preview.toolOutput ?? null,
		toolResponseMetadata: preview.toolResponseMetadata ?? null,
		get widgetState() {
			return widgetState;
		},
		// Stub API methods for preview
		callTool: async () => {
			throw new Error("callTool is not available in preview mode");
		},
		sendFollowUpMessage: async () => {
			throw new Error("sendFollowUpMessage is not available in preview mode");
		},
		openExternal: () => {
			throw new Error("openExternal is not available in preview mode");
		},
		requestDisplayMode: async () => ({ mode: config.displayMode ?? "inline" }),
		setWidgetState: async (state) => {
			widgetState = state as Record<string, unknown>;
			// Dispatch event to notify subscribers (like useWidgetState hook)
			window.dispatchEvent(
				new CustomEvent<{ globals: Partial<OpenAiGlobals> }>(
					SET_GLOBALS_EVENT_TYPE,
					{ detail: { globals: { widgetState } } },
				),
			);
		},
	};
}
