import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { useEffect, useState } from "preact/hooks";
import { LocationProvider } from "preact-iso";
import type { CollectedFile } from "../../src/vite/types.js";
import { client } from "./api/client.js";
import { PromptList } from "./components/PromptList.js";
import { ResourceList } from "./components/ResourceList.js";
import { ToolList } from "./components/ToolList.js";
import { ToolPreview } from "./components/ToolPreview.js";
import { listDevTools } from "./mcp/client.js";

interface FilePanelsState {
	resources: CollectedFile[];
	prompts: CollectedFile[];
}

export function App() {
	const [tools, setTools] = useState<Tool[]>([]);
	const [filePanels, setFilePanels] = useState<FilePanelsState>({
		resources: [],
		prompts: [],
	});
	const [loading, setLoading] = useState(true);
	const [activeTab, setActiveTab] = useState<"tools" | "resources" | "prompts">(
		"tools",
	);
	const [previewTool, setPreviewTool] = useState<Tool | null>(null);

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

	return (
		<LocationProvider>
			<div class="max-w-7xl mx-auto p-4">
				<header class="mb-6">
					<h1 class="text-2xl font-bold">chapplin Dev Server</h1>
				</header>

				<div class="flex gap-2 border-b border-gray-300 mb-4">
					<button
						type="button"
						class={`px-4 py-2 border-b-2 transition-colors ${
							activeTab === "tools"
								? "border-blue-500 text-blue-600 font-semibold"
								: "border-transparent text-gray-600 hover:text-gray-900"
						}`}
						onClick={() => setActiveTab("tools")}
					>
						Tools
					</button>
					<button
						type="button"
						class={`px-4 py-2 border-b-2 transition-colors ${
							activeTab === "resources"
								? "border-blue-500 text-blue-600 font-semibold"
								: "border-transparent text-gray-600 hover:text-gray-900"
						}`}
						onClick={() => setActiveTab("resources")}
					>
						Resources
					</button>
					<button
						type="button"
						class={`px-4 py-2 border-b-2 transition-colors ${
							activeTab === "prompts"
								? "border-blue-500 text-blue-600 font-semibold"
								: "border-transparent text-gray-600 hover:text-gray-900"
						}`}
						onClick={() => setActiveTab("prompts")}
					>
						Prompts
					</button>
				</div>

				{loading ? (
					<div class="text-center py-8 text-gray-500">Loading...</div>
				) : (
					<>
						<div id="tools" class={activeTab === "tools" ? "block" : "hidden"}>
							<h2 class="text-xl font-semibold mb-4">Tools</h2>
							<ToolList
								tools={tools}
								onPreview={(tool) => setPreviewTool(tool)}
							/>
						</div>

						<div
							id="resources"
							class={activeTab === "resources" ? "block" : "hidden"}
						>
							<h2 class="text-xl font-semibold mb-4">Resources</h2>
							<ResourceList resources={filePanels.resources} />
						</div>

						<div
							id="prompts"
							class={activeTab === "prompts" ? "block" : "hidden"}
						>
							<h2 class="text-xl font-semibold mb-4">Prompts</h2>
							<PromptList prompts={filePanels.prompts} />
						</div>

						{previewTool && (
							<div class="mt-5">
								<h2 class="text-xl font-semibold mb-4">
									Preview: {previewTool.name}
								</h2>
								<button
									type="button"
									class="mb-2.5 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
									onClick={() => setPreviewTool(null)}
								>
									Close Preview
								</button>
								<ToolPreview
									tool={previewTool}
									onClose={() => setPreviewTool(null)}
								/>
							</div>
						)}
					</>
				)}
			</div>
		</LocationProvider>
	);
}
