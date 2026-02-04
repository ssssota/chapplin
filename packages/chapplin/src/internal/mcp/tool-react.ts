import type { ComponentType, ReactElement } from "react";
import { useEffect, useState } from "react";
import { jsx } from "react/jsx-runtime";
import { createRoot } from "react-dom/client";
import type { OpenAiGlobals } from "../../openai.js";
import { createGlobalGetterHooks } from "../openai/client.js";

type Widget = { app: ComponentType<OpenAiGlobals> };

const hooks = createGlobalGetterHooks({ useState, useEffect });

export function defineTool(
	_name: unknown,
	_config: unknown,
	_cb: unknown,
	widget?: Widget,
): void {
	if (!widget) return;
	const container = document.getElementById("app");
	if (container) createRoot(container).render(jsx(App, { app: widget.app }));
}

function App(props: Widget): ReactElement {
	return jsx(props.app, {
		displayMode: hooks.useDisplayMode(),
		theme: hooks.useTheme(),
		userAgent: hooks.useUserAgent(),
		locale: hooks.useLocale(),
		maxHeight: hooks.useMaxHeight(),
		safeArea: hooks.useSafeArea(),
		toolInput: hooks.useToolInput(),
		toolOutput: hooks.useToolOutput(),
		toolResponseMetadata: hooks.useToolResponseMetadata(),
		widgetState: hooks.useWidgetState(),
	});
}
