import { defineApp, defineTool } from "chapplin";
import z from "zod";

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
			filteredTodos = todos.filter((todo) => todo.completed);
		} else if (args.filter === "pending") {
			filteredTodos = todos.filter((todo) => !todo.completed);
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
	ui: (props) => (
		<div>
			<h1>TODO リスト</h1>
			<p>フィルター: {props.input.filter}</p>
			{props.output ? (
				<div>
					<p>合計: {props.output.total}件</p>
					<ul>
						{props.output.todos.map((todo) => (
							<li>
								{todo.completed ? "[x]" : "[ ]"} {todo.title}
							</li>
						))}
					</ul>
				</div>
			) : (
				<p>読み込み中...</p>
			)}
		</div>
	),
});
