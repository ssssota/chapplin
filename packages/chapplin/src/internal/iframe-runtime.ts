import type { OpenAiGlobals } from "../openai.js";

export function initialize(w: Window & { openai: Partial<OpenAiGlobals> }) {
	w.openai ||= {
		async callTool(name, args) {
			console.warn("callTool", { name, args });
			// biome-ignore lint/suspicious/noExplicitAny: ignore
			return Promise.resolve({} as any);
		},
		displayMode: "inline",
		locale: "en-US",
		maxHeight: 1080,
		safeArea: {
			insets: { top: 0, bottom: 0, left: 0, right: 0 },
		},
		theme: "light",
		userAgent: {
			device: { type: "desktop" },
			capabilities: { hover: true, touch: false },
		},
		openExternal(payload) {
			window.parent.postMessage({ type: "openai:open_external", payload }, {});
		},
		requestDisplayMode(_args) {
			// window.parent.postMessage(
			// 	{ type: "openai:request_display_mode", payload: args },
			// 	{},
			// );
			return Promise.resolve({ mode: "inline" });
		},
		sendFollowUpMessage(_args) {
			// window.parent.postMessage(
			// 	{ type: "openai:send_followup_message", payload: args },
			// 	{},
			// );
			return Promise.resolve();
		},
		setWidgetState(state) {
			(window.openai as { widgetState?: unknown }).widgetState = state;
			return Promise.resolve();
		},
		widgetState: null,
		toolInput: {},
		toolOutput: null,
		toolResponseMetadata: null,
	};
}
