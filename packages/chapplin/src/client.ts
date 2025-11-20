import { type OpenAiGlobals, SET_GLOBALS_EVENT_TYPE } from "./openai.js";

const handlers = new Set<() => void>();
function handler() {
	for (const h of handlers) h();
}

function subscribe(callback: () => void) {
	if (handlers.size === 0) {
		window.addEventListener(SET_GLOBALS_EVENT_TYPE, handler, { passive: true });
	}

	handlers.add(callback);
	return () => {
		handlers.delete(callback);

		if (handlers.size === 0) {
			window.removeEventListener(SET_GLOBALS_EVENT_TYPE, handler);
		}
	};
}

export function createGlobalGetterHooks(hooks: {
	useState: <U>(initial: U) => [U, (updater: (prev: U) => U) => void];
	useEffect: (cb: () => void, deps: unknown[]) => void;
}) {
	return {
		useToolInput: createGlobalGetterHook((openai) => openai.toolInput, hooks),
		useToolOutput: createGlobalGetterHook((openai) => openai.toolOutput, hooks),
		useToolResponseMetadata: createGlobalGetterHook(
			(openai) => openai.toolResponseMetadata,
			hooks,
		),
		useWidgetState: createGlobalGetterHook(
			(openai) => openai.widgetState,
			hooks,
		),
		useTheme: createGlobalGetterHook((openai) => openai.theme, hooks),
		useUserAgent: createGlobalGetterHook((openai) => openai.userAgent, hooks),
		useLocale: createGlobalGetterHook((openai) => openai.locale, hooks),
		useMaxHeight: createGlobalGetterHook((openai) => openai.maxHeight, hooks),
		useDisplayMode: createGlobalGetterHook(
			(openai) => openai.displayMode,
			hooks,
		),
		useSafeArea: createGlobalGetterHook((openai) => openai.safeArea, hooks),
	};
}

function createGlobalGetterHook<T>(
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
