import { useState } from "preact/hooks";
import { client } from "../api/client.js";

interface ToolPreviewProps {
	toolName: string;
	onClose?: () => void;
}

export function ToolPreview({ toolName }: ToolPreviewProps) {
	const [input, setInput] = useState("{}");
	const [output, setOutput] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const handleUpdateInput = async () => {
		try {
			const parsedInput = JSON.parse(input);
			const res = await client.tools[":name"].execute.$post({
				param: { name: toolName },
			});

			if (!res.ok) {
				throw new Error(`HTTP error! status: ${res.status}`);
			}

			const result = await res.json();
			setOutput(JSON.stringify(result, null, 2));
			setError(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Unknown error");
			setOutput(null);
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
				>
					Update
				</button>

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
					class="w-full h-[500px] border border-gray-800 bg-white rounded"
					title={`Preview of ${toolName}`}
					src={`/iframe/tools/${toolName}.tsx`}
				/>
			</div>
		</div>
	);
}
