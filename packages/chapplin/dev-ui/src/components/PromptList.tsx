import type { CollectedFile } from "../../../src/vite/types";

interface PromptListProps {
	prompts: CollectedFile[];
}

export function PromptList({ prompts }: PromptListProps) {
	if (prompts.length === 0) {
		return <div class="px-1 py-1 text-xs text-slate-500">No prompts found</div>;
	}

	return (
		<ul class="list-none space-y-0.5">
			{prompts.map((prompt) => (
				<li
					key={prompt.name}
					class="truncate px-2 py-1 text-xs text-slate-700 dark:text-slate-300"
				>
					<span>{prompt.name}</span>
				</li>
			))}
		</ul>
	);
}
