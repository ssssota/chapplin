import type { CollectedFile } from "../../../src/vite/types";

interface ResourceListProps {
	resources: CollectedFile[];
}

export function ResourceList({ resources }: ResourceListProps) {
	if (resources.length === 0) {
		return <div class="text-center py-8 text-gray-500">No resources found</div>;
	}

	return (
		<ul class="list-none space-y-2">
			{resources.map((resource) => (
				<li
					key={resource.name}
					class="p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
				>
					<span>{resource.name}</span>
				</li>
			))}
		</ul>
	);
}
