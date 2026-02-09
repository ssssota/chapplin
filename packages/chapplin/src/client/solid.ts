import type { Component } from "solid-js";
import { createSignal } from "solid-js";
import { createComponent, render } from "solid-js/web";
import { App as ExtApp, applyHostStyleVariables } from "@modelcontextprotocol/ext-apps";
import type { AppProps } from "../types.js";

/**
 * Initialize Solid.js app (dev/build shared runtime)
 */
export function init(App: Component<AppProps>, options?: InitOptions) {
	const { appInfo, capabilities, appOptions, rootId } = resolveOptions(options);
	const root = document.getElementById(rootId);
	if (!root) {
		console.error(`Root element not found: ${rootId}`);
		return;
	}

	const [input, setInput] = createSignal<AppProps["input"]>({});
	const [output, setOutput] = createSignal<AppProps["output"]>({
		content: [],
	});
	const [hostContext, setHostContext] = createSignal<AppProps["hostContext"]>(
		undefined,
	);
	const [status, setStatus] = createSignal<"connecting" | "ready" | "error">(
		"connecting",
	);
	const [error, setError] = createSignal<unknown>(null);

	const renderMessage = (message: string, color?: string) => {
		const div = document.createElement("div");
		div.style.cssText = `padding: 20px;${color ? ` color: ${color};` : ""}`;
		div.textContent = message;
		return div;
	};

	render(() => {
		if (status() === "error") {
			const err = error();
			const message =
				err instanceof Error ? `Error: ${err.message}` : `Error: ${err}`;
			return renderMessage(message, "red");
		}
		if (status() === "connecting") {
			return renderMessage("Connecting...");
		}
		return createComponent(App, {
			input: input(),
			output: output(),
			hostContext: hostContext(),
		});
	}, root);

	const app = new ExtApp(appInfo, capabilities, appOptions);

	app.ontoolinput = (params) => {
		setInput(params);
	};

	app.ontoolresult = (params) => {
		setOutput(params);
	};

	app.onhostcontextchanged = (params) => {
		setHostContext(params);
		applyHostStyleVariables();
	};

	app
		.connect()
		.then(() => {
			const context = app.getHostContext();
			if (context) {
				setHostContext(context);
				applyHostStyleVariables();
				const maybeToolInput = getHostToolInput(context);
				if (maybeToolInput) setInput(maybeToolInput);
				const maybeToolResult = getHostToolResult(context);
				if (maybeToolResult) setOutput(maybeToolResult);
			}
			setStatus("ready");
		})
		.catch((err) => {
			setError(err);
			setStatus("error");
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
