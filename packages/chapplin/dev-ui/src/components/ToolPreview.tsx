import { getToolUiResourceUri } from "@modelcontextprotocol/ext-apps/app-bridge";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import {
	createDevIframePathFromToolPath,
	parseToolPathFromDevToolUiResourceUri,
} from "../../../src/vite/plugins/dev-app-path.js";
import {
	createPreviewHostBridge,
	type PreviewHostBridge,
} from "../mcp/host-bridge.js";

interface ToolPreviewProps {
	tool: Tool;
	onClose?: () => void;
}

export function ToolPreview({ tool }: ToolPreviewProps) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const bridgeRef = useRef<PreviewHostBridge | null>(null);
	const setupSequenceRef = useRef(0);
	const [iframeSrc, setIframeSrc] = useState("about:blank");
	const [input, setInput] = useState("{}");
	const [output, setOutput] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isConnecting, setIsConnecting] = useState(false);
	const [isRunning, setIsRunning] = useState(false);

	const disposeBridge = useCallback(async () => {
		if (!bridgeRef.current) return;
		const bridge = bridgeRef.current;
		bridgeRef.current = null;
		await bridge.dispose();
	}, []);

	const connectBridge = useCallback(async () => {
		const iframe = iframeRef.current;
		if (!iframe) return;

		const sequence = ++setupSequenceRef.current;
		setIsConnecting(true);
		setError(null);

		try {
			const appResourceUri = getToolUiResourceUri(tool);
			if (!appResourceUri) {
				throw new Error(
					`Tool '${tool.name}' does not expose an app resource URI`,
				);
			}
			const toolPath = parseToolPathFromDevToolUiResourceUri(appResourceUri);
			if (!toolPath) {
				throw new Error(`Invalid app resource URI: ${appResourceUri}`);
			}

			await disposeBridge();
			const bridge = await createPreviewHostBridge({
				iframe,
				tool,
			});

			if (sequence !== setupSequenceRef.current) {
				await bridge.dispose();
				return;
			}

			bridgeRef.current = bridge;
			setIframeSrc(createDevIframePathFromToolPath(toolPath));
		} catch (e) {
			if (sequence === setupSequenceRef.current) {
				setError(e instanceof Error ? e.message : "Unknown error");
			}
		} finally {
			if (sequence === setupSequenceRef.current) {
				setIsConnecting(false);
			}
		}
	}, [disposeBridge, tool]);

	useEffect(() => {
		setOutput(null);
		setError(null);
		setIframeSrc("about:blank");
		void connectBridge();
	}, [connectBridge]);

	useEffect(() => {
		return () => {
			setupSequenceRef.current += 1;
			void disposeBridge();
		};
	}, [disposeBridge]);

	const handleUpdateInput = async () => {
		try {
			const parsedInput = JSON.parse(input);
			if (
				parsedInput === null ||
				Array.isArray(parsedInput) ||
				typeof parsedInput !== "object"
			) {
				throw new Error("Input must be a JSON object");
			}

			if (!bridgeRef.current) {
				throw new Error("Preview host is not connected yet");
			}

			setIsRunning(true);
			const result = await bridgeRef.current.executeTool(parsedInput);
			setOutput(JSON.stringify(result, null, 2));
			setError(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Unknown error");
			setOutput(null);
		} finally {
			setIsRunning(false);
		}
	};

	return (
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
			<div class="space-y-4">
				<h2 class="text-lg font-semibold">Input</h2>
				<textarea
					id="input"
					class="w-full h-48 font-mono p-2.5 border border-gray-300 rounded resize-none"
					value={input}
					onInput={(e) => setInput(e.currentTarget.value)}
				/>
				<button
					type="button"
					class="px-5 py-2.5 mt-2.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
					onClick={handleUpdateInput}
					disabled={isConnecting || isRunning}
				>
					{isRunning ? "Running..." : "Run"}
				</button>
				{isConnecting && (
					<div class="text-sm text-gray-600 mt-2.5">
						Connecting MCP host bridge...
					</div>
				)}

				<h2 class="text-lg font-semibold">Output</h2>
				<textarea
					id="output"
					class="w-full h-48 font-mono p-2.5 border border-gray-300 rounded resize-none bg-gray-50"
					readOnly
					value={output || ""}
				/>
				{error && <div class="text-red-600 mt-2.5">Error: {error}</div>}
			</div>
			<div class="space-y-4">
				<h2 class="text-lg font-semibold">App Preview</h2>
				<iframe
					id="frame"
					ref={iframeRef}
					class="w-full h-[500px] border border-gray-800 bg-white rounded"
					title={`Preview of ${tool.name}`}
					src={iframeSrc}
				/>
			</div>
		</div>
	);
}
