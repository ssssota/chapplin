import type { CollectedFile } from "../../../src/vite/types";

interface PromptListProps {
	prompts: CollectedFile[];
}

export function PromptList({ prompts }: PromptListProps) {
	if (prompts.length === 0) {
		return <div class="text-center py-8 text-gray-500">No prompts found</div>;
	}

	return (
		<ul class="list-none space-y-2">
			{prompts.map((prompt) => (
				<li
					key={prompt.name}
					class="p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
				>
					<span>{prompt.name}</span>
				</li>
			))}
		</ul>
	);
}
