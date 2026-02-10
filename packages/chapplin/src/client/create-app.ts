import { App } from "@modelcontextprotocol/ext-apps";
import type { AppDefinition } from "../define.js";
import type { AppProps } from "../types.js";

export function createApp(
	config: AppDefinition["config"],
	handlers: {
		onToolInput: (input: AppProps["input"]) => void;
		onToolResult: (output: AppProps["output"]) => void;
		onHostContextChanged: (context: AppProps["hostContext"]) => void;
	},
): App {
	const app = new App(config.appInfo, config.capabilities, config.options);
	app.ontoolinput = handlers.onToolInput;
	app.ontoolresult = handlers.onToolResult;
	app.onhostcontextchanged = handlers.onHostContextChanged;
	return app;
}
