import { type OpenAiGlobals, SET_GLOBALS_EVENT_TYPE } from "./openai.js";

export function createGlobalGetterHooks(hooks: {
	useState: <T>(initial: T) => [T, (newValue: T) => void];
	useEffect: (cb: () => void, deps: unknown[]) => void;
}) {
	const subscribe = createGlobalsSubscribe();

	return {
		useToolInput: createGlobalGetterHook<OpenAiGlobals["toolInput"]>(
			subscribe,
			(openai) => openai.toolInput,
			hooks,
		),
		useToolOutput: createGlobalGetterHook<OpenAiGlobals["toolOutput"]>(
			subscribe,
			(openai) => openai.toolOutput,
			hooks,
		),
		useToolResponseMetadata: createGlobalGetterHook<
			OpenAiGlobals["toolResponseMetadata"]
		>(subscribe, (openai) => openai.toolResponseMetadata, hooks),
		useWidgetState: createGlobalGetterHook<OpenAiGlobals["widgetState"]>(
			subscribe,
			(openai) => openai.widgetState,
			hooks,
		),
		useTheme: createGlobalGetterHook<OpenAiGlobals["theme"]>(
			subscribe,
			(openai) => openai.theme,
			hooks,
		),
		useUserAgent: createGlobalGetterHook<OpenAiGlobals["userAgent"]>(
			subscribe,
			(openai) => openai.userAgent,
			hooks,
		),
		useLocale: createGlobalGetterHook<OpenAiGlobals["locale"]>(
			subscribe,
			(openai) => openai.locale,
			hooks,
		),
		useMaxHeight: createGlobalGetterHook<OpenAiGlobals["maxHeight"]>(
			subscribe,
			(openai) => openai.maxHeight,
			hooks,
		),
		useDisplayMode: createGlobalGetterHook<OpenAiGlobals["displayMode"]>(
			subscribe,
			(openai) => openai.displayMode,
			hooks,
		),
		useSafeArea: createGlobalGetterHook<OpenAiGlobals["safeArea"]>(
			subscribe,
			(openai) => openai.safeArea,
			hooks,
		),
	};
}

type ReturnValueOr<T> = T extends () => infer R ? R : T;

export function createGlobalGetterHook<
	Getter extends unknown | (() => unknown),
>(
	subscribe: (callback: () => void) => () => void,
	get: (openai: OpenAiGlobals) => ReturnValueOr<Getter>,
	hooks: {
		useState: (
			initial: ReturnValueOr<Getter>,
		) => [Getter, (newValue: ReturnValueOr<Getter>) => void];
		useEffect: (cb: () => void, deps: unknown[]) => void;
	},
): () => Getter {
	return () => {
		const [state, setState] = hooks.useState(get(window.openai ?? {}));
		hooks.useEffect(() => {
			return subscribe(() => {
				setState(get(window.openai ?? {}));
			});
		}, []);
		return state;
	};
}

export function createGlobalsSubscribe() {
	const handlers = new Set<() => void>();
	const handler = () => {
		for (const h of handlers) h();
	};

	function subscribe(callback: () => void) {
		if (handlers.size === 0) {
			window.addEventListener(SET_GLOBALS_EVENT_TYPE, handler, {
				passive: true,
			});
		}

		handlers.add(callback);
		return () => {
			handlers.delete(callback);

			if (handlers.size === 0) {
				window.removeEventListener(SET_GLOBALS_EVENT_TYPE, handler);
			}
		};
	}
	return subscribe;
}
