import type { McpUiHostContext } from "@modelcontextprotocol/ext-apps/app-bridge";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks";
import { LocationProvider } from "preact-iso";
import type { CollectedFile } from "../../src/vite/types.js";
import { client } from "./api/client.js";
import {
	createInitialHostContextEditorState,
	type HostContextEditorState,
	HostContextPopover,
} from "./components/HostContextPopover.js";
import { PromptList } from "./components/PromptList.js";
import { ResourceList } from "./components/ResourceList.js";
import { ToolList } from "./components/ToolList.js";
import { ToolPreview } from "./components/ToolPreview.js";
import { listDevTools } from "./mcp/client.js";

interface FilePanelsState {
	resources: CollectedFile[];
	prompts: CollectedFile[];
}

function toPreviewHostContext(
	state: HostContextEditorState,
	tool: Tool | null,
): McpUiHostContext {
	return {
		displayMode: state.displayMode,
		availableDisplayModes: ["inline", "fullscreen", "pip"],
		locale: state.locale,
		theme: state.theme,
		timeZone: state.timeZone,
		platform: state.platform,
		userAgent: state.userAgent,
		toolInfo: tool ? { tool } : undefined,
	};
}

export function App() {
	const hostContextPopoverId = "host-context-popover";
	const [tools, setTools] = useState<Tool[]>([]);
	const [filePanels, setFilePanels] = useState<FilePanelsState>({
		resources: [],
		prompts: [],
	});
	const [loading, setLoading] = useState(true);
	const [selectedToolName, setSelectedToolName] = useState<string | null>(null);
	const [isHostContextOpen, setIsHostContextOpen] = useState(false);
	const hostContextToggleRef = useRef<HTMLButtonElement>(null);
	const hostContextPopoverRef = useRef<HTMLDivElement>(null);
	const [hostContextEditor, setHostContextEditor] =
		useState<HostContextEditorState>(() =>
			createInitialHostContextEditorState(),
		);

	const updateHostContextEditor = useCallback(
		(state: HostContextEditorState) => {
			setHostContextEditor(state);
			document.documentElement.classList.toggle("dark", state.theme === "dark");
		},
		[],
	);

	useEffect(() => {
		const load = async () => {
			try {
				const [toolsFromMcp, filesRes] = await Promise.all([
					listDevTools(),
					client.files.$get(),
				]);

				setTools(toolsFromMcp);

				if (!filesRes.ok) {
					console.error("Failed to load files:", filesRes.status);
					return;
				}

				const data = await filesRes.json();
				setFilePanels({
					resources: data.resources,
					prompts: data.prompts,
				});
			} catch (err) {
				console.error("Failed to load dev UI data:", err);
			} finally {
				setLoading(false);
			}
		};

		void load();
	}, []);

	useEffect(() => {
		if (!isHostContextOpen) return;

		const onPointerDown = (event: PointerEvent) => {
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (hostContextPopoverRef.current?.contains(target)) return;
			if (hostContextToggleRef.current?.contains(target)) return;
			setIsHostContextOpen(false);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			setIsHostContextOpen(false);
			hostContextToggleRef.current?.focus();
		};

		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [isHostContextOpen]);

	const selectedTool =
		tools.find((tool) => tool.name === selectedToolName) ?? null;

	const previewHostContext = useMemo(
		() => toPreviewHostContext(hostContextEditor, selectedTool),
		[hostContextEditor, selectedTool],
	);

	return (
		<LocationProvider>
			<div class="h-screen w-screen bg-[#f3f3f3] text-slate-900 dark:bg-[#1e1e1e] dark:text-slate-100">
				{loading ? (
					<div class="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
						Loading...
					</div>
				) : (
					<div class="grid h-full grid-cols-[280px_minmax(0,1fr)]">
						<aside class="overflow-hidden border-r border-slate-300 bg-[#f8f8f8] text-slate-900 dark:border-slate-700 dark:bg-[#181818] dark:text-slate-100">
							<div class="border-b border-slate-300 px-3 py-2 text-sm font-semibold tracking-wide dark:border-slate-700">
								chapplin
							</div>
							<div class="h-[calc(100%-37px)] space-y-2 overflow-y-auto px-2 py-2">
								<section>
									<h2 class="mb-1 px-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
										Tools
									</h2>
									<ToolList
										tools={tools}
										selectedToolName={selectedToolName}
										onSelect={(tool) => setSelectedToolName(tool.name)}
									/>
								</section>

								<section class="border-t border-slate-300 pt-2 dark:border-slate-700">
									<h2 class="mb-1 px-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
										Resources
									</h2>
									<ResourceList resources={filePanels.resources} />
								</section>

								<section class="border-t border-slate-300 pt-2 dark:border-slate-700">
									<h2 class="mb-1 px-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
										Prompts
									</h2>
									<PromptList prompts={filePanels.prompts} />
								</section>
							</div>
						</aside>

						<main class="flex min-h-0 flex-col bg-[#f3f3f3] dark:bg-[#1e1e1e]">
							<div class="relative flex h-9 items-center justify-between border-b border-slate-300 px-3 dark:border-slate-700">
								<div class="text-xs text-slate-500 dark:text-slate-400">
									{selectedTool ? selectedTool.name : "Preview"}
								</div>
								<div class="flex items-center gap-1.5">
									<button
										type="button"
										class="border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
										onClick={() =>
											setHostContextEditor((prev) => {
												const newTheme =
													prev.theme === "dark" ? "light" : "dark";
												document.documentElement.classList.toggle(
													"dark",
													newTheme === "dark",
												);
												return { ...prev, theme: newTheme };
											})
										}
										data-testid="theme-toggle"
									>
										Theme: {hostContextEditor.theme}
									</button>
									<button
										ref={hostContextToggleRef}
										type="button"
										class="border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
										onClick={() => setIsHostContextOpen((prev) => !prev)}
										aria-expanded={isHostContextOpen}
										aria-controls={hostContextPopoverId}
										data-testid="host-context-toggle"
									>
										Host Context
									</button>
								</div>

								{isHostContextOpen && (
									<HostContextPopover
										id={hostContextPopoverId}
										containerRef={hostContextPopoverRef}
										value={hostContextEditor}
										onChange={updateHostContextEditor}
										onClose={() => setIsHostContextOpen(false)}
									/>
								)}
							</div>
							<div class="min-h-0 flex-1 overflow-y-auto px-3 py-2">
								{selectedTool ? (
									<ToolPreview
										tool={selectedTool}
										hostContext={previewHostContext}
									/>
								) : (
									<div class="flex h-full items-center justify-center border border-dashed border-slate-300 text-center text-slate-500 dark:border-slate-700 dark:text-slate-500">
										<div>
											<p class="text-base font-semibold">No tool selected</p>
											<p class="mt-1 text-sm">
												Choose a tool from the sidebar to start previewing.
											</p>
										</div>
									</div>
								)}
							</div>
						</main>
					</div>
				)}
			</div>
		</LocationProvider>
	);
}
