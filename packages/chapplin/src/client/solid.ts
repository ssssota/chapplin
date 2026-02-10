import { applyHostStyleVariables } from "@modelcontextprotocol/ext-apps";
import type { Component } from "solid-js";
import { createSignal, onCleanup, onMount } from "solid-js";
import { createComponent, render } from "solid-js/web";
import type { AppProps } from "../types.js";
import { createApp } from "./create-app.js";

/**
 * Initialize Solid.js app (dev/build shared runtime)
 */
export function init(App: Component<AppProps>, options?: InitOptions) {
	const { config, rootId } = resolveOptions(options);
	const root = document.getElementById(rootId);
	if (!root) {
		console.error(`Root element not found: ${rootId}`);
		return;
	}

	render(() => {
		const [input, setInput] = createSignal<AppProps["input"]>({});
		const [output, setOutput] = createSignal<AppProps["output"]>({
			content: [],
		});
		const [hostContext, setHostContext] =
			createSignal<AppProps["hostContext"]>(undefined);

		let disposed = false;
		let app: ReturnType<typeof createApp> | null = null;

		const applyStyles = (context: AppProps["hostContext"]) => {
			const styles = context?.styles?.variables;
			if (styles) {
				applyHostStyleVariables(styles);
			}
		};

		onMount(() => {
			app = createApp(config, {
				onToolInput: (params) => {
					if (disposed) return;
					setInput(params);
				},
				onToolResult: (params) => {
					if (disposed) return;
					setOutput(params);
				},
				onHostContextChanged: (params) => {
					if (disposed) return;
					setHostContext(params);
					applyStyles(params);
				},
			});

			void app
				.connect()
				.then(() => {
					if (disposed || !app) return;
					const context = app.getHostContext();
					if (!context) return;

					setHostContext(context);
					applyStyles(context);
				})
				.catch((error) => {
					console.error("[chapplin] Failed to connect MCP App client:", error);
				});
		});

		onCleanup(() => {
			disposed = true;
			if (app) {
				void app.close();
			}
		});

		return createComponent(App, {
			input: input(),
			output: output(),
			hostContext: hostContext(),
		});
	}, root);
}

type AppConfig = Parameters<typeof createApp>[0];

interface InitOptions {
	appInfo?: AppConfig["appInfo"];
	capabilities?: AppConfig["capabilities"];
	options?: AppConfig["options"];
	rootId?: string;
}

function resolveOptions(options?: InitOptions) {
	return {
		config: {
			appInfo: options?.appInfo ?? { name: "chapplin-app", version: "1.0.0" },
			capabilities: options?.capabilities ?? {},
			options: options?.options,
		},
		rootId: options?.rootId ?? "root",
	};
}
