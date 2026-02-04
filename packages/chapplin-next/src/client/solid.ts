import type { Component } from "solid-js";
import { createComponent, render } from "solid-js/web";

/**
 * Initialize Solid.js app in development preview
 */
export function init(App: Component<AppProps>) {
	const root = document.getElementById("root");
	if (!root) {
		console.error("Root element not found");
		return;
	}

	render(
		() => createComponent(App, { input: {}, output: null, meta: null }),
		root,
	);
}

interface AppProps {
	input: Record<string, unknown>;
	output: unknown;
	meta: unknown;
}
