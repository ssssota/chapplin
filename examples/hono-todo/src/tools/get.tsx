import { defineTool } from "chapplin/tool";
import z from "zod";

// Example URL to fetch data from
const todos = [
	{ id: 1, title: "Buy groceries", completed: false },
	{ id: 2, title: "Walk the dog", completed: true },
	{ id: 3, title: "Read a book", completed: false },
];

export default defineTool(
	"get",
	{
		inputSchema: {},
		outputSchema: {
			todos: z.array(
				z.object({
					id: z.number(),
					title: z.string(),
					completed: z.boolean(),
				}),
			),
		},
	},
	async () => {
		// Simulate fetching data from an external source
		return {
			content: [
				{
					type: "text",
					text: `${todos.length} todos remaining.`,
				},
			],
			structuredContent: {
				todos: todos,
			},
			_meta: {
				timestamp: new Date().toISOString(),
			},
		};
	},
	{
		app: ({ toolOutput, toolResponseMetadata }) => (
			<div>
				<h1>GET Tool Example</h1>
				<small>{toolResponseMetadata?.timestamp}</small>
				<p>Status: {toolOutput?.todos.length} todos remaining.</p>
				<ul>
					{toolOutput?.todos.map((todo) => (
						<li key={todo.id}>
							{todo.title} - {todo.completed ? "Completed" : "Pending"}
						</li>
					))}
				</ul>
			</div>
		),
		preview: {
			toolOutput: { todos },
			toolResponseMetadata: { timestamp: new Date().toISOString() },
		},
	},
);
