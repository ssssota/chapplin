import {
	createContext,
	type JSXNode,
	jsx,
	render,
	useContext,
	useEffect,
	useState,
} from "hono/jsx/dom";
import type { AppDefinition } from "../define.js";
import type { AppProps } from "../types.js";
import { type App, createApp } from "./create-app.js";

// biome-ignore lint/style/noNonNullAssertion: Context is always provided by AppWrapper
export const Context = createContext<App>(undefined!);

export function useApp(): App {
	return useContext(Context);
}

/**
 * Initialize Hono app (dev/build shared runtime)
 */
export function init(appDef: AppDefinition) {
	const root = document.getElementById("root");
	if (!root) {
		console.error("Root element not found: root");
		return;
	}

	const appController = createApp(appDef.config);

	const AppWrapper = () => {
		const [input, setInput] = useState<AppProps["input"]>();
		const [output, setOutput] = useState<AppProps["output"]>();
		const [hostContext, setHostContext] = useState<AppProps["hostContext"]>();

		useEffect(() => {
			const unsubscribeToolInput = appController.subscribeToolInput(setInput);
			const unsubscribeToolResult =
				appController.subscribeToolResult(setOutput);
			const unsubscribeHostContext =
				appController.subscribeHostContext(setHostContext);

			return () => {
				unsubscribeToolInput();
				unsubscribeToolResult();
				unsubscribeHostContext();
				appController.app.close();
			};
		}, []);

		const Provider = Context.Provider;
		const App = appDef.ui as (props: AppProps) => JSXNode;
		// @ts-expect-error
		return jsx(Provider, {
			value: appController.app,
			children: jsx(App, {
				input,
				output,
				hostContext,
			}),
		});
	};

	render(jsx(AppWrapper, {}), root);
}
