import {
	type ComponentType,
	createContext,
	useContext,
	useEffect,
	useState,
} from "react";
import { jsx } from "react/jsx-runtime";
import { createRoot } from "react-dom/client";
import type { AppDefinition } from "../define.js";
import type { AppProps } from "../types.js";
import { type App, createApp } from "./create-app.js";

// biome-ignore lint/style/noNonNullAssertion: Context is always provided by AppWrapper
export const Context = createContext<App>(undefined!);

export function useApp(): App {
	return useContext(Context);
}

/**
 * Initialize React app (dev/build shared runtime)
 */
export function init(appDef: AppDefinition) {
	const root = document.getElementById("root");
	if (!root) {
		console.error(`Root element not found: root`);
		return;
	}

	const reactRoot = createRoot(root);
	const appController = createApp(appDef.config);

	const AppWrapper: ComponentType = () => {
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

		const App = appDef.ui as ComponentType<AppProps>;
		return jsx(Context.Provider, {
			value: appController.app,
			children: jsx(App, {
				input,
				output,
				hostContext,
			}),
		});
	};

	reactRoot.render(jsx(AppWrapper, {}));
}
