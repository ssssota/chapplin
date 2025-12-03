---
title: Why Chapplin?
description: Understand the benefits and reasons for using Chapplin to build ChatGPT Apps
---

The [OpenAI Apps SDK](https://developers.openai.com/apps-sdk) provides only primitive specifications for building ChatGPT Apps. While this gives developers flexibility, it also introduces significant complexity when building production-ready applications.

## The Challenge with Raw OpenAI Apps SDK

When you need to provide a UI for your ChatGPT App, the OpenAI Apps SDK requires you to register a **single HTML file** containing all JavaScript and CSS bundled together with the MCP server. This presents several challenges:

### Complex Build Process

Creating this all-in-one HTML bundle is not trivial. You need to:
- Set up a build pipeline that bundles JavaScript and CSS
- Inline all assets into a single HTML string
- Ensure the bundled code works correctly in the ChatGPT environment
- Manage different build configurations for development and production

Building this infrastructure from scratch requires deep knowledge of bundlers like Vite, webpack, or Rollup, along with custom plugins to handle the specific requirements of the OpenAI Apps SDK.

### Type Safety Issues

Even if you successfully set up the build process, maintaining type safety across your application becomes challenging:

- **Disconnected types**: The types for `toolOutput` and other runtime data are difficult to share between your server-side tool definitions and client-side UI components
- **Manual synchronization**: When you update your tool's output schema, you must manually update the corresponding UI component types
- **No compile-time checks**: Without proper type sharing, you won't catch type mismatches until runtime, leading to potential bugs in production

This complexity increases development time, introduces more opportunities for errors, and makes maintaining the codebase more difficult.

## How Chapplin Solves These Problems

Chapplin abstracts away all this complexity and provides an **all-in-one, type-safe development environment** for building Apps in ChatGPT.

### Hidden Build Process

Chapplin includes built-in Vite plugins that handle the entire build process automatically:
- Automatically bundles JavaScript and CSS into a single HTML string
- Provides hot module reloading during development
- Optimizes production builds without any configuration
- Generates the correct format expected by the OpenAI Apps SDK

You can focus on writing your application logic and UI components without worrying about the build infrastructure.

### End-to-End Type Safety

With Chapplin, types flow seamlessly from your tool definitions to your UI components:

```tsx
import { defineTool } from "chapplin/tool";
import z from "zod";

export default defineTool(
	"getTodos",
	{
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
		return {
			content: [{ type: "text", text: "Fetched todos" }],
			structuredContent: { todos: [...] },
		};
	},
	{
		// toolOutput is automatically typed based on your outputSchema!
		app: ({ toolOutput }) => (
			<div>
				{toolOutput.todos.map((todo) => (
					<div key={todo.id}>{todo.title}</div>
				))}
			</div>
		),
	},
);
```

The `toolOutput` parameter in your `app` component is automatically typed based on your `outputSchema`. This means:
- **Autocompletion**: Your IDE provides intelligent suggestions
- **Compile-time errors**: Type mismatches are caught before runtime
- **Refactoring safety**: Changes to schemas automatically propagate to UI code

### Unified Development Experience

Chapplin provides a cohesive development experience where everything works together:
- Define tools with Zod schemas
- Build UI with your preferred JSX library (React, Preact, Solid, or Hono JSX)
- Integrate with your preferred server framework (Hono, Express, Fastify, etc.)
- Deploy with confidence knowing types are enforced throughout

## Summary

While the OpenAI Apps SDK gives you the raw building blocks, Chapplin gives you a complete framework that:
- ✅ Eliminates complex build configuration
- ✅ Ensures type safety from tool definitions to UI components
- ✅ Provides a smooth development experience with hot reloading
- ✅ Reduces boilerplate and lets you focus on your app's unique features

If you're building Apps in ChatGPT, Chapplin removes the friction and lets you focus on creating great user experiences.
