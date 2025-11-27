# chapplin

chapplin is a ChatGPT Apps framework.
This allow developers to create MCP servers for [OpenAI Apps SDK](https://developers.openai.com/apps-sdk) with type-safe JSX.

* Type-safe tools
* JSX-based app rendering
* Framework agnostic
  * Hono, Express, Fastify, etc. for server
  * React, Preact, Hono for UI

## Usage

```sh
npm create chapplin@latest
```

## Example Todo tool

```tsx
import { defineTool } from "chapplin/tool";
import z from "zod";
export default defineTool(
	"get",
	{
		inputSchema: {},
		outputSchema: {
			todos: z.array(z.object({ id: z.number(), title: z.string(), completed: z.boolean() })),
		},
	},
	async () => {
		const todos = await fetchTodos();
		return {
			content: [{ type: "text", text: `${todos.length} todos remaining.` }],
			structuredContent: { todos },
		};
	},
	{
		app: ({ toolOutput }) => (
			<div>
				<h1>GET Tool Example</h1>
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
	},
);
```

## License

MIT
