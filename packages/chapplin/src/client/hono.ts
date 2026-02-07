import type { Child, JSXNode } from "hono/jsx";
import { jsx, render } from "hono/jsx/dom";

type Component = (props: unknown) => JSXNode;

/**
 * Initialize Hono app in development preview
 */
export function init(App: (props: AppProps) => Child) {
	const root = document.getElementById("root");
	if (!root) {
		console.error("Root element not found");
		return;
	}

	render(jsx(App as Component, { input: {}, output: null, meta: null }), root);
}

interface AppProps {
	input: Record<string, unknown>;
	output: unknown;
	meta: unknown;
}
