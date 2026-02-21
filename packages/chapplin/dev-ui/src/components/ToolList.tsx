import { getToolUiResourceUri } from "@modelcontextprotocol/ext-apps/app-bridge";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

interface ToolListProps {
	tools: Tool[];
	selectedToolName: string | null;
	onSelect: (tool: Tool) => void;
}

export function ToolList({ tools, selectedToolName, onSelect }: ToolListProps) {
	if (tools.length === 0) {
		return <div class="px-1 py-2 text-xs text-slate-500">No tools found</div>;
	}

	return (
		<ul class="list-none space-y-0.5">
			{tools.map((tool) => {
				const hasApp = Boolean(getToolUiResourceUri(tool));
				const isSelected = selectedToolName === tool.name;
				return (
					<li key={tool.name}>
						<button
							type="button"
							class={`w-full rounded px-2 py-1.5 text-left text-xs transition-colors ${
								isSelected
									? "bg-slate-300 text-slate-900 dark:bg-slate-700 dark:text-slate-50"
									: "text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
							}`}
							onClick={() => onSelect(tool)}
							data-testid={`tool-item-${tool.name}`}
						>
							<div class="flex items-center justify-between gap-2">
								<span class="truncate">{tool.name}</span>
								{hasApp && (
									<span class="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-600 dark:text-slate-200">
										App
									</span>
								)}
							</div>
						</button>
					</li>
				);
			})}
		</ul>
	);
}
