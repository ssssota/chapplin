import {
	applyHostStyleVariables,
	App as ExtApp,
} from "@modelcontextprotocol/ext-apps";
import type { AppDefinition } from "../define.js";
import type { AppProps } from "../types.js";

export type App = Omit<ExtApp, `on${string}`>;

export function createApp(config: AppDefinition["config"]): {
	app: App;
	subscribeToolInput: (
		handler: (data: AppProps["input"]) => void,
	) => () => void;
	subscribeToolResult: (
		handler: (data: AppProps["output"]) => void,
	) => () => void;
	subscribeHostContext: (
		handler: (data: AppProps["hostContext"]) => void,
	) => () => void;
	syncHostContext: (context: AppProps["hostContext"]) => void;
} {
	const app = new ExtApp(config.appInfo, config.capabilities, config.options);

	const toolInputSubscriber = createSubscriber<AppProps["input"]>();
	const toolResultSubscriber = createSubscriber<AppProps["output"]>();
	const hostContextSubscriber = createSubscriber<AppProps["hostContext"]>();

	app.ontoolinput = toolInputSubscriber.emit;
	app.ontoolresult = toolResultSubscriber.emit;
	const syncHostContext = (context: AppProps["hostContext"]) => {
		hostContextSubscriber.emit(context);

		const styles = context?.styles?.variables;
		if (styles) applyHostStyleVariables(styles);
	};

	app.onhostcontextchanged = syncHostContext;

	app
		.connect()
		.then(() => {
			const context = app.getHostContext();
			if (!context) return;
			syncHostContext(context);
		})
		.catch((error) => {
			console.error("[chapplin] Failed to connect MCP App client:", error);
		});

	return {
		app,
		subscribeToolInput: toolInputSubscriber.subscribe,
		subscribeToolResult: toolResultSubscriber.subscribe,
		subscribeHostContext: hostContextSubscriber.subscribe,
		syncHostContext,
	};
}

function createSubscriber<T>(): {
	subscribe: (handler: (data: T) => void) => () => void;
	emit: (data: T) => void;
} {
	const handlers = new Set<(data: T) => void>();

	return {
		subscribe: (handler: (data: T) => void) => {
			handlers.add(handler);
			return () => {
				handlers.delete(handler);
			};
		},
		emit: (data: T) => {
			for (const handler of handlers) {
				handler(data);
			}
		},
	};
}
