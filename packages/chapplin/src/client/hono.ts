import type { Child, JSXNode } from "hono/jsx";
import { jsx, render, useEffect, useState } from "hono/jsx/dom";
import { applyHostStyleVariables } from "@modelcontextprotocol/ext-apps";
import { createApp } from "./create-app.js";
import type { AppProps } from "../types.js";

type Component = (props: unknown) => JSXNode;

/**
 * Initialize Hono app (dev/build shared runtime)
 */
export function init(App: (props: AppProps) => Child, options?: InitOptions) {
	const { config, rootId } = resolveOptions(options);
	const root = document.getElementById(rootId);
	if (!root) {
		console.error(`Root element not found: ${rootId}`);
		return;
	}

	const AppWrapper = () => {
		const [input, setInput] = useState<AppProps["input"]>({});
		const [output, setOutput] = useState<AppProps["output"]>({ content: [] });
		const [hostContext, setHostContext] =
			useState<AppProps["hostContext"]>(undefined);

		useEffect(() => {
			let disposed = false;
			const app = createApp(config, {
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

			const applyStyles = (context: AppProps["hostContext"]) => {
				const styles = context?.styles?.variables;
				if (styles) {
					applyHostStyleVariables(styles);
				}
			};

			void app
				.connect()
				.then(() => {
					if (disposed) return;
					const context = app.getHostContext();
					if (!context) return;
					setHostContext(context);
					applyStyles(context);
				})
				.catch((error) => {
					console.error("[chapplin] Failed to connect MCP App client:", error);
				});

			return () => {
				disposed = true;
				void app.close();
			};
		}, []);

		return jsx(App as Component, { input, output, hostContext });
	};

	render(jsx(AppWrapper, {}), root);
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
