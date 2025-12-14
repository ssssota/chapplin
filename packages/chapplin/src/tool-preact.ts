import type { ComponentType, VNode } from "preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { jsx } from "preact/jsx-runtime";
import { createGlobalGetterHooks } from "./client.js";
import type { OpenAiGlobals } from "./openai.js";
import { type Preview, initializePreview } from "./preview.js";

type Widget = {
	app: ComponentType<OpenAiGlobals>;
	preview?: Preview;
};

const hooks = createGlobalGetterHooks({ useState, useEffect });

export function defineTool(
	_name: unknown,
	_config: unknown,
	_cb: unknown,
	widget?: Widget,
): void {
	if (!widget) return;

	initializePreview(widget.preview);

	const container = document.getElementById("app");
	if (container) render(jsx(App, { app: widget.app }), container);
}

function App(props: Widget): VNode {
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
