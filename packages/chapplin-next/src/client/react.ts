import type { ComponentType } from "react";
import { jsx } from "react/jsx-runtime";
import { createRoot } from "react-dom/client";

/**
 * Initialize React app in development preview
 */
export function init(App: ComponentType<AppProps>) {
	const root = document.getElementById("root");
	if (!root) {
		console.error("Root element not found");
		return;
	}

	const reactRoot = createRoot(root);
	reactRoot.render(jsx(App, { input: {}, output: null, meta: null }));
}

interface AppProps {
	input: Record<string, unknown>;
	output: unknown;
	meta: unknown;
}
