import { z } from "zod";

/** ツール名 */
export const name = "get_todos";

/** ツール設定 */
export const config = {
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
};

// サンプルデータ
const todos = [
	{ id: 1, title: "牛乳を買う", completed: false },
	{ id: 2, title: "犬の散歩", completed: true },
	{ id: 3, title: "本を読む", completed: false },
	{ id: 4, title: "メールを送る", completed: true },
];

/** ツールハンドラー */
export async function handler(args: {
	filter: "all" | "completed" | "pending";
}) {
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
}

/** MCP App メタデータ */
export const appMeta = {
	prefersBorder: true,
};

/** MCP App コンポーネント */
export function App(props: {
	input: { filter: "all" | "completed" | "pending" };
	output: {
		todos: Array<{ id: number; title: string; completed: boolean }>;
		total: number;
	} | null;
	meta: Record<string, unknown> | null;
}) {
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
}
