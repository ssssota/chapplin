import type { Child, JSXNode } from "hono/jsx";
import { jsx, render, useEffect, useState } from "hono/jsx/dom";
import type { OpenAiGlobals } from "../../openai.js";
import { createGlobalGetterHooks } from "./client.js";

type Widget = { app: (props: OpenAiGlobals) => Child };
type Component = (props: unknown) => JSXNode;

const hooks = createGlobalGetterHooks({ useState, useEffect });

export function defineTool(
	_name: unknown,
	_config: unknown,
	_cb: unknown,
	widget?: Widget,
): void {
	if (!widget) return;
	const container = document.getElementById("app");
	if (container) render(jsx(App as Component, { app: widget.app }), container);
}

function App(props: Widget): JSXNode {
	return jsx(props.app as Component, {
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
