import type { Component } from "solid-js";
import {
	createContext,
	createEffect,
	createSignal,
	useContext,
} from "solid-js";
import { createComponent, render } from "solid-js/web";
import type { AppDefinition } from "../define.js";
import type { AppProps } from "../types.js";
import { type App, createApp } from "./create-app.js";

export const Context = createContext<App>();

export function useApp(): App {
	// biome-ignore lint/style/noNonNullAssertion: Context is always provided by AppWrapper
	return useContext(Context)!;
}

/**
 * Initialize Solid.js app (dev/build shared runtime)
 */
export function init(appDef: AppDefinition) {
	const root = document.getElementById("root");
	if (!root) {
		console.error("Root element not found: root");
		return;
	}

	const appController = createApp(appDef.config);

	render(() => {
		const [input, setInput] = createSignal<AppProps["input"]>();
		const [output, setOutput] = createSignal<AppProps["output"]>();
		const [hostContext, setHostContext] =
			createSignal<AppProps["hostContext"]>();

		createEffect(() => {
			const unsubscribeToolInput = appController.subscribeToolInput(setInput);
			const unsubscribeToolResult =
				appController.subscribeToolResult(setOutput);
			const unsubscribeHostContext =
				appController.subscribeHostContext(setHostContext);

			return () => {
				unsubscribeToolInput();
				unsubscribeToolResult();
				unsubscribeHostContext();
				appController.app.close();
			};
		});

		const App = appDef.ui as Component<AppProps>;
		return createComponent(Context.Provider, {
			value: appController.app,
			children: createComponent(App, {
				get input() {
					return input();
				},
				get output() {
					return output();
				},
				get hostContext() {
					return hostContext();
				},
			}),
		});
	}, root);
}
