import { defineApp, defineTool } from "chapplin";
import { useApp } from "chapplin/solid";
import { For, Show } from "solid-js";
import z from "zod";
import "./todos.css";

const todos = [
	{ id: 1, title: "牛乳を買う", completed: false },
	{ id: 2, title: "犬の散歩", completed: true },
	{ id: 3, title: "本を読む", completed: false },
	{ id: 4, title: "メールを送る", completed: true },
];
const envFile = import.meta.env.VITE_E2E_ENV_FILE ?? "unset";

export const tool = defineTool({
	name: "get_todos",
	config: {
		description: "TODOリストを取得します",
		inputSchema: {
			filter: z
				.enum(["all", "completed", "pending"])
				.default("all")
				.describe("フィルター"),
		},
		outputSchema: {
			todos: z.array(
				z.object({
					id: z.number(),
					title: z.string(),
					completed: z.boolean(),
				}),
			),
			total: z.number(),
		},
	},
	async handler(args) {
		let filteredTodos = todos;
		if (args.filter === "completed") {
			filteredTodos = todos.filter((t) => t.completed);
		} else if (args.filter === "pending") {
			filteredTodos = todos.filter((t) => !t.completed);
		}

		return {
			content: [
				{
					type: "text",
					text: `${filteredTodos.length}件のTODOがあります`,
				},
			],
			structuredContent: {
				todos: filteredTodos,
				total: filteredTodos.length,
			},
		};
	},
});

export const app = defineApp<typeof tool>({
	config: {
		appInfo: { name: "todo-app", version: "1.0.0" },
	},
	meta: {
		prefersBorder: true,
	},
	ui: (props) => {
		const app = useApp();
		const output = () => props.output?.structuredContent;
		const filter = () => props.input?.arguments?.filter ?? "all";
		const hostContext = () => props.hostContext;
		const linkUrl = "https://example.com/chapplin-useapp-e2e";
		const onClick = () => app.openLink({ url: linkUrl });
		return (
			<div
				class="todos-view"
				style={{ "font-family": "system-ui, sans-serif", padding: "20px" }}
			>
				<h1>TODO リスト</h1>
				<p>フィルター: {filter()}</p>
				<p>ENV_FILE: {envFile}</p>
				<div>
					<p data-testid="app-host-context-theme">
						{hostContext()?.theme ?? "-"}
					</p>
					<p data-testid="app-host-context-locale">
						{hostContext()?.locale ?? "-"}
					</p>
					<p data-testid="app-host-context-display-mode">
						{hostContext()?.displayMode ?? "-"}
					</p>
					<p data-testid="app-host-context-platform">
						{hostContext()?.platform ?? "-"}
					</p>
					<p data-testid="app-host-context-tool-name">
						{hostContext()?.toolInfo?.tool?.name ?? "-"}
					</p>
				</div>
				<img
					src="https://picsum.photos/id/0/200/200"
					alt="test csp"
					data-testid="csp-blocked-image"
				/>
				<button type="button" onClick={onClick}>
					Open docs
				</button>
				<Show when={output()} fallback={<p>読み込み中...</p>}>
					<p>合計: {output()?.total}件</p>
					<ul>
						<For each={output()?.todos}>
							{(todo) => (
								<li
									style={{
										"text-decoration": todo.completed ? "line-through" : "none",
									}}
								>
									{todo.title}
								</li>
							)}
						</For>
					</ul>
				</Show>
			</div>
		);
	},
});
