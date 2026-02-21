import type { CollectedFile } from "../../../src/vite/types";

interface ResourceListProps {
	resources: CollectedFile[];
}

export function ResourceList({ resources }: ResourceListProps) {
	if (resources.length === 0) {
		return (
			<div class="px-1 py-1 text-xs text-slate-500">No resources found</div>
		);
	}

	return (
		<ul class="list-none space-y-0.5">
			{resources.map((resource) => (
				<li
					key={resource.name}
					class="truncate px-2 py-1 text-xs text-slate-700 dark:text-slate-300"
				>
					<span>{resource.name}</span>
				</li>
			))}
		</ul>
	);
}
