import type { McpUiDisplayMode } from "@modelcontextprotocol/ext-apps/app-bridge";
import type { RefObject } from "preact";

export interface HostContextEditorState {
	displayMode: McpUiDisplayMode;
	locale: string;
	theme: "light" | "dark";
	timeZone: string;
	platform: "web" | "desktop" | "mobile";
	userAgent: string;
}

interface HostContextPopoverProps {
	id: string;
	containerRef?: RefObject<HTMLDivElement>;
	value: HostContextEditorState;
	onChange: (next: HostContextEditorState) => void;
	onClose: () => void;
}

export function createInitialHostContextEditorState(): HostContextEditorState {
	const prefersDark = window.matchMedia?.(
		"(prefers-color-scheme: dark)",
	).matches;

	return {
		displayMode: "inline",
		locale: navigator.language,
		theme: prefersDark ? "dark" : "light",
		timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		platform: "web",
		userAgent: navigator.userAgent,
	};
}

export function HostContextPopover({
	id,
	containerRef,
	value,
	onChange,
	onClose,
}: HostContextPopoverProps) {
	return (
		<div
			id={id}
			ref={containerRef}
			role="dialog"
			aria-label="Host Context"
			class="absolute top-10 right-3 z-20 w-[360px] border border-slate-300 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900"
			onKeyDown={(event) => {
				if (event.key !== "Escape") return;
				event.preventDefault();
				onClose();
			}}
		>
			<div class="mb-2 flex items-center justify-between gap-2">
				<div class="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
					Host Context
				</div>
				<button
					type="button"
					class="border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
					onClick={onClose}
					data-testid="host-context-close"
				>
					Close
				</button>
			</div>
			<div class="grid gap-2">
				<label class="grid gap-1 text-xs">
					<span class="text-slate-600 dark:text-slate-300">displayMode</span>
					<select
						class="border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
						value={value.displayMode}
						onChange={(e) =>
							onChange({
								...value,
								displayMode: e.currentTarget.value as McpUiDisplayMode,
							})
						}
						data-testid="host-context-display-mode"
					>
						<option value="inline">inline</option>
						<option value="fullscreen">fullscreen</option>
						<option value="pip">pip</option>
					</select>
				</label>
				<label class="grid gap-1 text-xs">
					<span class="text-slate-600 dark:text-slate-300">locale</span>
					<input
						class="border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
						value={value.locale}
						onInput={(e) =>
							onChange({
								...value,
								locale: e.currentTarget.value,
							})
						}
						data-testid="host-context-locale"
					/>
				</label>
				<label class="grid gap-1 text-xs">
					<span class="text-slate-600 dark:text-slate-300">theme</span>
					<select
						class="border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
						value={value.theme}
						onChange={(e) =>
							onChange({
								...value,
								theme: e.currentTarget.value as "light" | "dark",
							})
						}
						data-testid="host-context-theme"
					>
						<option value="light">light</option>
						<option value="dark">dark</option>
					</select>
				</label>
				<label class="grid gap-1 text-xs">
					<span class="text-slate-600 dark:text-slate-300">timeZone</span>
					<input
						class="border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
						value={value.timeZone}
						onInput={(e) =>
							onChange({
								...value,
								timeZone: e.currentTarget.value,
							})
						}
						data-testid="host-context-time-zone"
					/>
				</label>
				<label class="grid gap-1 text-xs">
					<span class="text-slate-600 dark:text-slate-300">platform</span>
					<select
						class="border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
						value={value.platform}
						onChange={(e) =>
							onChange({
								...value,
								platform: e.currentTarget.value as "web" | "desktop" | "mobile",
							})
						}
						data-testid="host-context-platform"
					>
						<option value="web">web</option>
						<option value="desktop">desktop</option>
						<option value="mobile">mobile</option>
					</select>
				</label>
				<label class="grid gap-1 text-xs">
					<span class="text-slate-600 dark:text-slate-300">userAgent</span>
					<input
						class="border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
						value={value.userAgent}
						onInput={(e) =>
							onChange({
								...value,
								userAgent: e.currentTarget.value,
							})
						}
						data-testid="host-context-user-agent"
					/>
				</label>
			</div>
		</div>
	);
}
