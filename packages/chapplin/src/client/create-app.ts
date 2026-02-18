import {
	applyHostStyleVariables,
	App as ExtApp,
} from "@modelcontextprotocol/ext-apps";
import type { AppDefinition } from "../define.js";
import { SET_GLOBALS_EVENT_TYPE, type SetGlobalsEvent } from "../openai.js";
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
} {
	const toolInputSubscriber = createSubscriber<AppProps["input"]>();
	const toolResultSubscriber = createSubscriber<AppProps["output"]>();
	const hostContextSubscriber = createSubscriber<AppProps["hostContext"]>();

	// Support OpenAI Apps SDK
	if (typeof window !== "undefined" && typeof window.openai !== "undefined") {
		const notCompat = (method: string) => {
			return new Error(`Not compatible with OpenAI Apps SDK: ${method}`);
		};
		let hostContext: AppProps["hostContext"];
		const onGlobalEvent = (ev: SetGlobalsEvent) => {
			const globals = ev.detail.globals;
			hostContext = {
				deviceCapabilities: globals.userAgent?.capabilities,
				displayMode: globals.displayMode,
				locale: globals.locale,
				safeAreaInsets: globals.safeArea?.insets,
				theme: globals.theme,
			};
			hostContextSubscriber.emit(hostContext);
			toolInputSubscriber.emit({ arguments: globals.toolInput });
			toolResultSubscriber.emit({
				content: [],
				structuredContent: globals.toolOutput ?? undefined,
				_meta: globals.toolResponseMetadata ?? undefined,
			});
		};
		window.addEventListener(SET_GLOBALS_EVENT_TYPE, onGlobalEvent, {
			passive: true,
		});
		return {
			app: {
				assertCanSetRequestHandler(_method) {
					throw notCompat("assertCanSetRequestHandler");
				},
				assertCapabilityForMethod(_method) {
					throw notCompat("assertCapabilityForMethod");
				},
				assertNotificationCapability(_method) {
					throw notCompat("assertNotificationCapability");
				},
				assertRequestHandlerCapability(_method) {
					throw notCompat("assertRequestHandlerCapability");
				},
				async connect(_transport, _options) {
					throw notCompat("connect");
				},
				callServerTool(params, _options) {
					return window.openai.callTool(params.name, params.arguments ?? {});
				},
				async close() {
					window.removeEventListener(SET_GLOBALS_EVENT_TYPE, onGlobalEvent);
					toolInputSubscriber.dispose();
					toolResultSubscriber.dispose();
					hostContextSubscriber.dispose();
				},
				getHostCapabilities() {
					return {};
				},
				getHostContext() {
					return hostContext;
				},
				getHostVersion() {
					return undefined;
				},
				async notification(_notification, _options) {
					throw notCompat("notification");
				},
				openLink(params, _options) {
					try {
						window.openai.openExternal({ href: params.url });
						return Promise.resolve({});
					} catch {
						return Promise.resolve({ isError: true });
					}
				},
				removeNotificationHandler(_method) {
					throw notCompat("removeNotificationHandler");
				},
				removeRequestHandler(_method) {
					throw notCompat("removeRequestHandler");
				},
				setNotificationHandler(_notificationSchema, _handler) {
					throw notCompat("setNotificationHandler");
				},
				request(_request, _resultSchema, _options) {
					throw notCompat("request");
				},
				requestDisplayMode(params, _options) {
					window.openai.requestDisplayMode({ mode: params.mode });
					return new Promise((resolve) => {
						setTimeout(() => resolve({ mode: window.openai.displayMode }), 100);
					});
				},
				sendLog(_params) {
					throw notCompat("sendLog");
				},
				sendMessage(_params, _options) {
					throw notCompat("sendMessage");
				},
				sendSizeChanged(_params) {
					throw notCompat("sendSizeChanged");
				},
				sendOpenLink(_params, _options) {
					throw notCompat("sendOpenLink");
				},
				setRequestHandler(_requestSchema, _handler) {
					throw notCompat("setRequestHandler");
				},
				setupSizeChangedNotifications() {
					throw notCompat("setupSizeChangedNotifications");
				},
				transport: undefined,
				updateModelContext(_params, _options) {
					throw notCompat("updateModelContext");
				},
				fallbackNotificationHandler(_notification) {
					throw notCompat("fallbackNotificationHandler");
				},
				fallbackRequestHandler(_request, _extra) {
					throw notCompat("fallbackRequestHandler");
				},
			},
			subscribeHostContext: hostContextSubscriber.subscribe,
			subscribeToolInput: toolInputSubscriber.subscribe,
			subscribeToolResult: toolResultSubscriber.subscribe,
		};
	}

	// MCP Apps Client
	const app = new ExtApp(config.appInfo, config.capabilities, config.options);

	app.ontoolinput = toolInputSubscriber.emit;
	app.ontoolresult = toolResultSubscriber.emit;
	const syncHostContext = (context: AppProps["hostContext"]) => {
		hostContextSubscriber.emit(context);

		const styles = context?.styles?.variables;
		if (styles) applyHostStyleVariables(styles);
	};

	app.onhostcontextchanged = syncHostContext;
	app.onclose = () => {
		toolInputSubscriber.dispose();
		toolResultSubscriber.dispose();
		hostContextSubscriber.dispose();
	};

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
	};
}

function createSubscriber<T>(): {
	subscribe: (handler: (data: T) => void) => () => void;
	emit: (data: T) => void;
	dispose: () => void;
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
		dispose: () => {
			handlers.clear();
		},
	};
}
