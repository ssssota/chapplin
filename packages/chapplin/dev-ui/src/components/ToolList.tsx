import { getToolUiResourceUri } from "@modelcontextprotocol/ext-apps/app-bridge";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

interface ToolListProps {
	tools: Tool[];
	onPreview?: (tool: Tool) => void;
}

export function ToolList({ tools, onPreview }: ToolListProps) {
	if (tools.length === 0) {
		return <div class="text-center py-8 text-gray-500">No tools found</div>;
	}

	return (
		<ul class="list-none space-y-2">
			{tools.map((tool) => {
				const hasApp = Boolean(getToolUiResourceUri(tool));
				return (
					<li
						key={tool.name}
						class="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
					>
						<span class="flex items-center gap-2">
							{tool.name}
							{hasApp && (
								<span class="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded">
									App
								</span>
							)}
						</span>
						{hasApp && onPreview && (
							<button
								type="button"
								class="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
								onClick={() => onPreview(tool)}
							>
								[Preview]
							</button>
						)}
					</li>
				);
			})}
		</ul>
	);
}
