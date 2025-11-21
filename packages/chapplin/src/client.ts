import { type OpenAiGlobals, SET_GLOBALS_EVENT_TYPE } from "./openai.js";

export function createGlobalGetterHooks(hooks: {
	useState: <U>(initial: U) => [U, (updater: (prev: U) => U) => void];
	useEffect: (cb: () => void, deps: unknown[]) => void;
}) {
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

	return {
		useToolInput: createGlobalGetterHook(
			subscribe,
			(openai) => openai.toolInput,
			hooks,
		),
		useToolOutput: createGlobalGetterHook(
			subscribe,
			(openai) => openai.toolOutput,
			hooks,
		),
		useToolResponseMetadata: createGlobalGetterHook(
			subscribe,
			(openai) => openai.toolResponseMetadata,
			hooks,
		),
		useWidgetState: createGlobalGetterHook(
			subscribe,
			(openai) => openai.widgetState,
			hooks,
		),
		useTheme: createGlobalGetterHook(
			subscribe,
			(openai) => openai.theme,
			hooks,
		),
		useUserAgent: createGlobalGetterHook(
			subscribe,
			(openai) => openai.userAgent,
			hooks,
		),
		useLocale: createGlobalGetterHook(
			subscribe,
			(openai) => openai.locale,
			hooks,
		),
		useMaxHeight: createGlobalGetterHook(
			subscribe,
			(openai) => openai.maxHeight,
			hooks,
		),
		useDisplayMode: createGlobalGetterHook(
			subscribe,
			(openai) => openai.displayMode,
			hooks,
		),
		useSafeArea: createGlobalGetterHook(
			subscribe,
			(openai) => openai.safeArea,
			hooks,
		),
	};
}

function createGlobalGetterHook<T>(
	subscribe: (callback: () => void) => () => void,
	get: (openai: OpenAiGlobals) => T,
	hooks: {
		useState: <U>(initial: U) => [U, (updater: (prev: U) => U) => void];
		useEffect: (cb: () => void, deps: unknown[]) => void;
	},
) {
	return (onChange?: (val: T) => void) => {
		const [state, setState] = hooks.useState<T>(get(window.openai ?? {}));
		hooks.useEffect(() => {
			return subscribe(() => {
				setState((prev) => {
					const next = get(window.openai ?? {});
					if (Object.is(prev, next)) return prev;
					onChange?.(next);
					return next;
				});
			});
		}, []);
		return state;
	};
}
