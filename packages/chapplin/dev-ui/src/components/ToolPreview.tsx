import type { McpUiHostContext } from "@modelcontextprotocol/ext-apps/app-bridge";
import { getToolUiResourceUri } from "@modelcontextprotocol/ext-apps/app-bridge";
import {
	CallToolResultSchema,
	type LoggingMessageNotification,
	type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import type { JSX } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import {
	createDevIframePathFromToolPath,
	parseToolPathFromDevToolUiResourceUri,
} from "../../../src/vite/plugins/dev-app-path.js";
import { connectDevMcp } from "../mcp/client.js";
import {
	createPreviewHostBridge,
	type PreviewHostBridge,
	type PreviewHostEvent,
} from "../mcp/host-bridge.js";
import {
	PreviewEventLog,
	type PreviewEventLogEntry,
} from "./PreviewEventLog.js";
import {
	buildInputFromDraft,
	createInitialInputDraft,
	type ToolInputDraft,
	ToolInputForm,
} from "./ToolInputForm.js";

interface ToolPreviewProps {
	tool: Tool;
	hostContext: McpUiHostContext;
}

type ToolInput = Record<string, unknown>;

const PREVIEW_WIDTH_PRESETS = [390, 768, 1024] as const;
const PREVIEW_MIN_WIDTH = 280;
const PREVIEW_MAX_WIDTH_FALLBACK = 1440;

function formatPreviewEvent(event: PreviewHostEvent): PreviewEventLogEntry {
	if (event.kind === "message" && "role" in event.payload) {
		const role = event.payload.role;
		const contentLength = Array.isArray(event.payload.content)
			? event.payload.content.length
			: 0;

		return {
			id: `${event.timestamp}-${Math.random().toString(36).slice(2, 7)}`,
			label: "MESSAGE",
			text: `role=${role} blocks=${contentLength}`,
			payload: event.payload,
			timestamp: event.timestamp,
		};
	}

	const payload = event.payload as LoggingMessageNotification["params"];
	return {
		id: `${event.timestamp}-${Math.random().toString(36).slice(2, 7)}`,
		label: String(payload.level).toUpperCase(),
		text: payload.logger ? `${payload.logger}` : "app-log",
		payload,
		timestamp: event.timestamp,
	};
}

export function ToolPreview({ tool, hostContext }: ToolPreviewProps) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const previewStageRef = useRef<HTMLDivElement>(null);
	const previewViewportRef = useRef<HTMLDivElement>(null);
	const bridgeRef = useRef<PreviewHostBridge | null>(null);
	const hostContextRef = useRef(hostContext);
	const setupSequenceRef = useRef(0);
	const copyStatusTimeoutRef = useRef<number | null>(null);
	const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(
		null,
	);
	const [iframeSrc, setIframeSrc] = useState("about:blank");
	const [previewWidth, setPreviewWidth] = useState<number | null>(null);
	const [isResizingPreview, setIsResizingPreview] = useState(false);
	const [inputDraft, setInputDraft] = useState<ToolInputDraft>(() =>
		createInitialInputDraft(tool),
	);
	const [output, setOutput] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isConnecting, setIsConnecting] = useState(false);
	const [isRunning, setIsRunning] = useState(false);
	const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
		"idle",
	);
	const [eventLogs, setEventLogs] = useState<PreviewEventLogEntry[]>([]);
	const hasApp = Boolean(getToolUiResourceUri(tool));

	const getPreviewMaxWidth = useCallback((): number => {
		const stageWidth = previewStageRef.current?.getBoundingClientRect().width;
		if (!stageWidth || !Number.isFinite(stageWidth)) {
			return PREVIEW_MAX_WIDTH_FALLBACK;
		}
		return Math.max(PREVIEW_MIN_WIDTH, Math.floor(stageWidth - 8));
	}, []);

	const clampPreviewWidth = useCallback(
		(width: number): number => {
			const maxWidth = getPreviewMaxWidth();
			return Math.max(PREVIEW_MIN_WIDTH, Math.min(Math.round(width), maxWidth));
		},
		[getPreviewMaxWidth],
	);

	const appendEventLog = useCallback((event: PreviewHostEvent) => {
		const entry = formatPreviewEvent(event);
		setEventLogs((prev) => [...prev.slice(-149), entry]);
	}, []);

	const disposeBridge = useCallback(async () => {
		if (!bridgeRef.current) return;
		const bridge = bridgeRef.current;
		bridgeRef.current = null;
		await bridge.dispose();
	}, []);

	const resolveIframePath = useCallback(() => {
		if (!hasApp) return null;

		const appResourceUri = getToolUiResourceUri(tool);
		if (!appResourceUri) {
			return null;
		}

		const toolPath = parseToolPathFromDevToolUiResourceUri(appResourceUri);
		if (!toolPath) {
			return null;
		}

		return createDevIframePathFromToolPath(toolPath);
	}, [hasApp, tool]);

	const connectBridge = useCallback(async () => {
		if (!hasApp) {
			setIsConnecting(false);
			setIframeSrc("about:blank");
			await disposeBridge();
			return;
		}

		const iframe = iframeRef.current;
		if (!iframe) return;

		const sequence = ++setupSequenceRef.current;
		setIsConnecting(true);
		setError(null);

		try {
			const iframePath = resolveIframePath();
			if (!iframePath) {
				throw new Error(`Tool '${tool.name}' does not expose an app preview`);
			}

			await disposeBridge();
			const bridge = await createPreviewHostBridge({
				iframe,
				tool,
				hostContext: hostContextRef.current,
				onEvent: appendEventLog,
			});

			if (sequence !== setupSequenceRef.current) {
				await bridge.dispose();
				return;
			}

			bridgeRef.current = bridge;
			setIframeSrc(iframePath);
		} catch (e) {
			if (sequence === setupSequenceRef.current) {
				setError(e instanceof Error ? e.message : "Unknown error");
			}
		} finally {
			if (sequence === setupSequenceRef.current) {
				setIsConnecting(false);
			}
		}
	}, [appendEventLog, disposeBridge, hasApp, resolveIframePath, tool]);

	useEffect(() => {
		hostContextRef.current = hostContext;
	}, [hostContext]);

	useEffect(() => {
		setInputDraft(createInitialInputDraft(tool));
		setOutput(null);
		setError(null);
		setCopyStatus("idle");
		setIframeSrc("about:blank");
		setEventLogs([]);
		void connectBridge();
	}, [connectBridge, tool]);

	useEffect(() => {
		if (!hasApp || !bridgeRef.current) return;
		void bridgeRef.current
			.sendHostContextChange(hostContext)
			.catch((reason) => {
				console.error("Failed to send host context change", reason);
			});
	}, [hasApp, hostContext]);

	useEffect(() => {
		return () => {
			setupSequenceRef.current += 1;
			if (copyStatusTimeoutRef.current !== null) {
				window.clearTimeout(copyStatusTimeoutRef.current);
			}
			resizeStateRef.current = null;
			void disposeBridge();
		};
	}, [disposeBridge]);

	useEffect(() => {
		const handleResize = () => {
			setPreviewWidth((current) =>
				current === null ? null : clampPreviewWidth(current),
			);
		};

		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, [clampPreviewWidth]);

	const executeToolWithoutAppPreview = useCallback(
		async (arguments_: ToolInput) => {
			const mcp = await connectDevMcp();
			try {
				return await mcp.client.callTool(
					{
						name: tool.name,
						arguments: arguments_,
					},
					CallToolResultSchema,
				);
			} finally {
				await mcp.close();
			}
		},
		[tool.name],
	);

	const handleRun = async () => {
		try {
			const parsedInput = buildInputFromDraft(tool, inputDraft);
			setIsRunning(true);

			const result =
				hasApp && bridgeRef.current
					? await bridgeRef.current.executeTool(parsedInput)
					: await executeToolWithoutAppPreview(parsedInput);

			setOutput(JSON.stringify(result, null, 2));
			setError(null);
			setCopyStatus("idle");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Unknown error");
			setOutput(null);
		} finally {
			setIsRunning(false);
		}
	};

	const handleResizePointerDown = (
		event: JSX.TargetedPointerEvent<HTMLButtonElement>,
	) => {
		if (event.button !== 0) return;
		event.preventDefault();

		const viewportWidth =
			previewViewportRef.current?.getBoundingClientRect().width ??
			PREVIEW_WIDTH_PRESETS[0];
		const baseWidth = clampPreviewWidth(previewWidth ?? viewportWidth);
		resizeStateRef.current = {
			startX: event.clientX,
			startWidth: baseWidth,
		};

		if (previewWidth === null) {
			setPreviewWidth(baseWidth);
		}
		setIsResizingPreview(true);
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const handleResizePointerMove = (
		event: JSX.TargetedPointerEvent<HTMLButtonElement>,
	) => {
		const state = resizeStateRef.current;
		if (!state) return;
		const delta = event.clientX - state.startX;
		setPreviewWidth(clampPreviewWidth(state.startWidth + delta));
	};

	const stopResizePreview = () => {
		resizeStateRef.current = null;
		setIsResizingPreview(false);
	};

	const handleResizeKeyDown = (
		event: JSX.TargetedKeyboardEvent<HTMLButtonElement>,
	) => {
		const viewportWidth =
			previewViewportRef.current?.getBoundingClientRect().width ??
			PREVIEW_WIDTH_PRESETS[0];
		const baseWidth = clampPreviewWidth(previewWidth ?? viewportWidth);
		const step = event.shiftKey ? 64 : 16;

		if (event.key === "ArrowLeft") {
			event.preventDefault();
			setPreviewWidth(clampPreviewWidth(baseWidth - step));
			return;
		}
		if (event.key === "ArrowRight") {
			event.preventDefault();
			setPreviewWidth(clampPreviewWidth(baseWidth + step));
			return;
		}
		if (event.key === "Home") {
			event.preventDefault();
			setPreviewWidth(PREVIEW_MIN_WIDTH);
			return;
		}
		if (event.key === "End") {
			event.preventDefault();
			setPreviewWidth(getPreviewMaxWidth());
		}
	};

	const handlePresetChange = (value: string) => {
		if (value === "fit") {
			setPreviewWidth(null);
			return;
		}

		const parsed = Number.parseInt(value, 10);
		if (Number.isFinite(parsed)) {
			setPreviewWidth(clampPreviewWidth(parsed));
		}
	};

	const previewWidthOption =
		previewWidth === null
			? "fit"
			: PREVIEW_WIDTH_PRESETS.includes(
						previewWidth as (typeof PREVIEW_WIDTH_PRESETS)[number],
					)
				? String(previewWidth)
				: "drag";
	const previewWidthLabel = previewWidth === null ? "Fit" : `${previewWidth}px`;
	const previewWidthForA11y = clampPreviewWidth(
		previewWidth ??
			previewViewportRef.current?.getBoundingClientRect().width ??
			PREVIEW_WIDTH_PRESETS[0],
	);
	const previewMaxWidth = getPreviewMaxWidth();

	return (
		<div class="text-slate-800 dark:text-slate-100">
			<section class="flex flex-col gap-2 border-b border-slate-300 pb-2 dark:border-slate-700">
				<div class="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
					<div>
						<p class="text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
							Preview Controller
						</p>
						<h2 class="text-sm font-semibold" data-testid="preview-tool-name">
							{tool.name}
						</h2>
					</div>
					<div class="flex flex-wrap gap-1">
						<button
							type="button"
							class="border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:disabled:text-slate-500"
							onClick={() => void connectBridge()}
							disabled={!hasApp || isConnecting}
							data-testid="preview-reconnect"
						>
							Reconnect
						</button>
						<button
							type="button"
							class="border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:disabled:text-slate-500"
							onClick={() => {
								setInputDraft(createInitialInputDraft(tool));
								setError(null);
							}}
							data-testid="preview-reset-input"
						>
							Reset Input
						</button>
						<button
							type="button"
							class="border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:disabled:text-slate-500"
							onClick={() => {
								const iframePath = resolveIframePath();
								if (!iframePath) {
									setError(
										`Tool '${tool.name}' does not expose an app preview`,
									);
									return;
								}
								setIframeSrc("about:blank");
								window.setTimeout(() => {
									void connectBridge();
								}, 0);
							}}
							disabled={!hasApp || isConnecting}
							data-testid="preview-reload"
						>
							Reload Preview
						</button>
					</div>
				</div>
				<div class="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
					<label class="flex items-center gap-1" for="preview-width-preset">
						<span>Width</span>
						<select
							id="preview-width-preset"
							class="border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
							value={previewWidthOption}
							onChange={(e) => handlePresetChange(e.currentTarget.value)}
							data-testid="preview-width-preset"
						>
							<option value="fit">Fit</option>
							<option value="390">390px</option>
							<option value="768">768px</option>
							<option value="1024">1024px</option>
							<option value="drag" disabled>
								Custom (drag)
							</option>
						</select>
					</label>
					<span data-testid="preview-width-value">{previewWidthLabel}</span>
					{hasApp && isConnecting && <span>Connecting MCP host bridge...</span>}
				</div>
			</section>

			<section class="border-b border-slate-300 py-2 dark:border-slate-700">
				<h3 class="mb-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
					Preview
				</h3>
				<div
					ref={previewStageRef}
					class="overflow-x-auto"
					data-testid="preview-width-stage"
				>
					<div class="flex min-w-full justify-center py-1">
						<div
							ref={previewViewportRef}
							class="relative shrink-0"
							style={{
								width: previewWidth === null ? "100%" : `${previewWidth}px`,
								maxWidth: "100%",
							}}
							data-testid="preview-viewport"
						>
							{hasApp ? (
								<iframe
									id="frame"
									ref={iframeRef}
									class="h-[360px] w-full border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950"
									title={`Preview of ${tool.name}`}
									src={iframeSrc}
									data-testid="preview-frame"
								/>
							) : (
								<div
									class="flex h-[360px] w-full items-center justify-center border border-dashed border-slate-300 bg-slate-50 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
									data-testid="preview-no-app"
								>
									<div>
										<p class="text-sm font-semibold">
											No App Preview Available
										</p>
										<p class="mt-1 text-xs">
											This tool does not define `defineApp`, but you can still
											run it.
										</p>
									</div>
								</div>
							)}
							<button
								type="button"
								class={`absolute top-0 right-0 h-full w-2 translate-x-1/2 cursor-ew-resize border-0 bg-slate-300/70 transition dark:bg-slate-600/70 ${
									isResizingPreview
										? "opacity-100"
										: "opacity-40 hover:opacity-80"
								}`}
								role="slider"
								aria-orientation="horizontal"
								aria-valuemin={PREVIEW_MIN_WIDTH}
								aria-valuemax={previewMaxWidth}
								aria-valuenow={previewWidthForA11y}
								aria-valuetext={previewWidthLabel}
								aria-label="Resize preview width"
								title="Drag to resize preview width"
								onPointerDown={handleResizePointerDown}
								onPointerMove={handleResizePointerMove}
								onPointerUp={stopResizePreview}
								onPointerCancel={stopResizePreview}
								onLostPointerCapture={stopResizePreview}
								onKeyDown={handleResizeKeyDown}
								data-testid="preview-resize-handle"
							/>
						</div>
					</div>
				</div>
			</section>

			<section class="grid gap-3 py-2 lg:grid-cols-[minmax(0,1fr)_360px]">
				<div class="space-y-2 lg:border-r lg:border-slate-300 lg:pr-3 dark:lg:border-slate-700">
					<div id="input" data-testid="preview-input">
						<h3 class="mb-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
							Input
						</h3>
						<ToolInputForm
							tool={tool}
							draft={inputDraft}
							onDraftChange={(name, value) => {
								setInputDraft((prev) => ({ ...prev, [name]: value }));
							}}
						/>
					</div>
					<button
						type="button"
						class="w-full bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:bg-sky-300 dark:bg-sky-500 dark:hover:bg-sky-400 dark:disabled:bg-sky-800"
						onClick={handleRun}
						disabled={isRunning || (hasApp && isConnecting)}
						data-testid="preview-run"
					>
						{isRunning ? "Running..." : "Run"}
					</button>
				</div>

				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<h3 class="text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
							Output
						</h3>
						<button
							type="button"
							class="border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:disabled:text-slate-500"
							onClick={() => {
								void (async () => {
									try {
										await navigator.clipboard.writeText(output ?? "");
										setCopyStatus("copied");
									} catch {
										setCopyStatus("failed");
									}

									if (copyStatusTimeoutRef.current !== null) {
										window.clearTimeout(copyStatusTimeoutRef.current);
									}
									copyStatusTimeoutRef.current = window.setTimeout(() => {
										setCopyStatus("idle");
									}, 1200);
								})();
							}}
							disabled={!output}
							data-testid="preview-copy-output"
						>
							Copy Output
						</button>
					</div>
					<textarea
						id="output"
						class="h-52 w-full resize-none border border-slate-300 bg-slate-50 p-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
						readOnly
						value={output || ""}
						data-testid="preview-output"
					/>
					{copyStatus === "copied" && (
						<div class="text-xs text-sky-600 dark:text-sky-400">
							Output copied.
						</div>
					)}
					{copyStatus === "failed" && (
						<div class="text-xs text-red-500 dark:text-red-400">
							Failed to copy output.
						</div>
					)}
					{error && (
						<div
							class="text-xs text-red-500 dark:text-red-400"
							data-testid="preview-error"
						>
							Error: {error}
						</div>
					)}

					<PreviewEventLog events={eventLogs} />
				</div>
			</section>
		</div>
	);
}
