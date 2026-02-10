import { applyHostStyleVariables } from "@modelcontextprotocol/ext-apps";
import { type ComponentType, useEffect, useState } from "react";
import { jsx } from "react/jsx-runtime";
import { createRoot } from "react-dom/client";
import type { AppProps } from "../types.js";
import { createApp } from "./create-app.js";

/**
 * Initialize React app (dev/build shared runtime)
 */
export function init(App: ComponentType<AppProps>, options?: InitOptions) {
	const { config } = resolveOptions(options);
	const root = document.getElementById("root");
	if (!root) {
		console.error(`Root element not found: root`);
		return;
	}

	const reactRoot = createRoot(root);

	const AppWrapper: ComponentType = () => {
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

		return jsx(App, { input, output, hostContext });
	};

	reactRoot.render(jsx(AppWrapper, {}));
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
