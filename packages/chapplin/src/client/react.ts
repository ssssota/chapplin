import type { ComponentType } from "react";
import { jsx } from "react/jsx-runtime";
import { createRoot } from "react-dom/client";
import { App as ExtApp, applyHostStyleVariables } from "@modelcontextprotocol/ext-apps";
import type { AppProps } from "../types.js";

/**
 * Initialize React app (dev/build shared runtime)
 */
export function init(App: ComponentType<AppProps>, options?: InitOptions) {
	const { appInfo, capabilities, appOptions, rootId } = resolveOptions(options);
	const root = document.getElementById(rootId);
	if (!root) {
		console.error(`Root element not found: ${rootId}`);
		return;
	}

	const reactRoot = createRoot(root);
	const state: AppProps = {
		input: {},
		output: { content: [] },
		hostContext: undefined,
	};

	const renderMessage = (message: string, color?: string) => {
		reactRoot.render(
			jsx(
				"div",
				{ style: { padding: "20px", color: color ?? "inherit" } },
				message,
			),
		);
	};

	const renderApp = () => {
		reactRoot.render(jsx(App, state));
	};

	renderMessage("Connecting...");

	const app = new ExtApp(appInfo, capabilities, appOptions);

	app.ontoolinput = (params) => {
		state.input = params;
		renderApp();
	};

	app.ontoolresult = (params) => {
		state.output = params;
		renderApp();
	};

	app.onhostcontextchanged = (params) => {
		state.hostContext = params;
		applyHostStyleVariables();
		renderApp();
	};

	app
		.connect()
		.then(() => {
			const context = app.getHostContext();
			if (context) {
				state.hostContext = context;
				applyHostStyleVariables();
				const maybeToolInput = getHostToolInput(context);
				if (maybeToolInput) state.input = maybeToolInput;
				const maybeToolResult = getHostToolResult(context);
				if (maybeToolResult) state.output = maybeToolResult;
			}
			renderApp();
		})
		.catch((err) => {
			const message =
				err instanceof Error ? `Error: ${err.message}` : `Error: ${err}`;
			renderMessage(message, "red");
		});

	window.addEventListener("beforeunload", () => app.close());
}

type AppParams = ConstructorParameters<typeof ExtApp>;

interface InitOptions {
	appInfo?: AppParams[0];
	capabilities?: AppParams[1];
	options?: AppParams[2];
	rootId?: string;
}

function resolveOptions(options?: InitOptions) {
	return {
		appInfo: options?.appInfo ?? { name: "chapplin-app", version: "1.0.0" },
		capabilities: options?.capabilities ?? {},
		appOptions: options?.options,
		rootId: options?.rootId ?? "root",
	};
}

function getHostToolInput(
	context: Record<string, unknown>,
): AppProps["input"] | null {
	const value = context.toolInput;
	if (!value || typeof value !== "object") return null;
	return value as AppProps["input"];
}

function getHostToolResult(
	context: Record<string, unknown>,
): AppProps["output"] | null {
	const value = context.toolResult;
	if (!value || typeof value !== "object") return null;
	return value as AppProps["output"];
}
