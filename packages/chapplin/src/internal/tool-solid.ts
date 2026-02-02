import { type Component, createEffect, createSignal } from "solid-js";
import { createComponent, render } from "solid-js/web";
import { createGlobalGetterHook, createGlobalsSubscribe } from "../client.js";
import type { OpenAiGlobals } from "../openai.js";

type Widget = { app: Component<OpenAiGlobals> };

export function defineTool(
	_name: unknown,
	_config: unknown,
	_cb: unknown,
	widget?: Widget,
): void {
	if (!widget) return;
	const container = document.getElementById("app");
	if (container)
		render(
			() => createComponent(widget.app, createReactiveGlobals()),
			container,
		);
}

function createReactiveGlobals(): OpenAiGlobals {
	const subscribe = createGlobalsSubscribe();
	const hooks = { useState: createSignal, useEffect: createEffect };
	const useToolInput = createGlobalGetterHook<() => OpenAiGlobals["toolInput"]>(
		subscribe,
		(openai) => openai.toolInput,
		hooks,
	)();
	const useToolOutput = createGlobalGetterHook<
		() => OpenAiGlobals["toolOutput"]
	>(subscribe, (openai) => openai.toolOutput, hooks)();
	const useToolResponseMetadata = createGlobalGetterHook<
		() => OpenAiGlobals["toolResponseMetadata"]
	>(subscribe, (openai) => openai.toolResponseMetadata, hooks)();
	const useWidgetState = createGlobalGetterHook<
		() => OpenAiGlobals["widgetState"]
	>(subscribe, (openai) => openai.widgetState, hooks)();
	const useTheme = createGlobalGetterHook<() => OpenAiGlobals["theme"]>(
		subscribe,
		(openai) => openai.theme,
		hooks,
	)();
	const useUserAgent = createGlobalGetterHook<() => OpenAiGlobals["userAgent"]>(
		subscribe,
		(openai) => openai.userAgent,
		hooks,
	)();
	const useLocale = createGlobalGetterHook<() => OpenAiGlobals["locale"]>(
		subscribe,
		(openai) => openai.locale,
		hooks,
	)();
	const useMaxHeight = createGlobalGetterHook<() => OpenAiGlobals["maxHeight"]>(
		subscribe,
		(openai) => openai.maxHeight,
		hooks,
	)();
	const useDisplayMode = createGlobalGetterHook<
		() => OpenAiGlobals["displayMode"]
	>(subscribe, (openai) => openai.displayMode, hooks)();
	const useSafeArea = createGlobalGetterHook<() => OpenAiGlobals["safeArea"]>(
		subscribe,
		(openai) => openai.safeArea,
		hooks,
	)();

	return {
		get toolInput() {
			return useToolInput();
		},
		get toolOutput() {
			return useToolOutput();
		},
		get toolResponseMetadata() {
			return useToolResponseMetadata();
		},
		get widgetState() {
			return useWidgetState();
		},
		get theme() {
			return useTheme();
		},
		get userAgent() {
			return useUserAgent();
		},
		get locale() {
			return useLocale();
		},
		get maxHeight() {
			return useMaxHeight();
		},
		get displayMode() {
			return useDisplayMode();
		},
		get safeArea() {
			return useSafeArea();
		},
	};
}
