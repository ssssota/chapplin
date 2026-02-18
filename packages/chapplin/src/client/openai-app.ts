import type { App as ExtApp } from "@modelcontextprotocol/ext-apps";
import { SET_GLOBALS_EVENT_TYPE, type SetGlobalsEvent } from "../openai";

export const createOpenAiApp = (
	globals: Window["openai"],
	onChange: (ev: SetGlobalsEvent) => void,
	onClose: () => void,
): Omit<ExtApp, `on${string}`> => {
	const notCompat = (method: string) => {
		return new Error(`Not compatible with OpenAI Apps SDK: ${method}`);
	};
	window.addEventListener(SET_GLOBALS_EVENT_TYPE, onChange, { passive: true });
	return {
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
			return globals.callTool(params.name, params.arguments ?? {});
		},
		async close() {
			window.removeEventListener(SET_GLOBALS_EVENT_TYPE, onChange);
			onClose();
		},
		getHostCapabilities() {
			return {};
		},
		getHostContext() {
			return {
				deviceCapabilities: globals.userAgent?.capabilities,
				displayMode: globals.displayMode,
				locale: globals.locale,
				safeAreaInsets: globals.safeArea?.insets,
				theme: globals.theme,
			};
		},
		getHostVersion() {
			return undefined;
		},
		async notification(_notification, _options) {
			throw notCompat("notification");
		},
		openLink(params, _options) {
			try {
				globals.openExternal({ href: params.url });
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
			return globals.requestDisplayMode(params);
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
	};
};
