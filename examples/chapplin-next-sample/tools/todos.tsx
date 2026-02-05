import { defineApp, defineTool } from "chapplin-next";
import { z } from "zod";

const todos = [
	{ id: 1, title: "牛乳を買う", completed: false },
	{ id: 2, title: "犬の散歩", completed: true },
	{ id: 3, title: "本を読む", completed: false },
	{ id: 4, title: "メールを送る", completed: true },
];

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
					type: "text" as const,
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
	meta: {
		prefersBorder: true,
	},
	ui: (props) => {
		const { input, output } = props;
		return (
			<div style={{ fontFamily: "system-ui, sans-serif", padding: "20px" }}>
				<h1>TODO リスト</h1>
				<p>フィルター: {input.filter}</p>
				{output ? (
					<>
						<p>合計: {output.total}件</p>
						<ul>
							{output.todos.map((todo) => (
								<li
									key={todo.id}
									style={{
										textDecoration: todo.completed ? "line-through" : "none",
									}}
								>
									{todo.title}
								</li>
							))}
						</ul>
					</>
				) : (
					<p>読み込み中...</p>
				)}
			</div>
		);
	},
});
