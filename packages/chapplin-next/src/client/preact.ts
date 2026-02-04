import type { ComponentType } from "preact";
import { render } from "preact";
import { jsx } from "preact/jsx-runtime";

/**
 * Initialize Preact app in development preview
 */
export function init(App: ComponentType<AppProps>) {
	const root = document.getElementById("root");
	if (!root) {
		console.error("Root element not found");
		return;
	}

	render(jsx(App, { input: {}, output: null, meta: null }), root);
}

interface AppProps {
	input: Record<string, unknown>;
	output: unknown;
	meta: unknown;
}
