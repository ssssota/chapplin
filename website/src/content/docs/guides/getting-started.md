---
title: Getting Started
description: Learn how to create your first ChatGPT App with Chapplin
---

Welcome to Chapplin! This guide will help you create your first ChatGPT App using the Model Context Protocol (MCP).

## What You'll Build

In this guide, you'll create a simple MCP server with a "get todos" tool that:
- Fetches a list of todos
- Returns structured data
- Renders a beautiful UI with JSX

## Create Your First App

The fastest way to get started is using the `create-chapplin` scaffolding tool:

```bash
npm create chapplin@latest
```

### Project Structure

After creation, your project will have this structure:

```
my-chapplin-app/
├── src/
│   ├── index.ts          # Server entry point
│   └── tools/
│       └── get.tsx       # Example tool
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Install Dependencies

Navigate to your project and install dependencies:

```bash
cd my-chapplin-app
npm install
```

## Development

Start the development server:

```bash
npm run dev
```

This will:
- Start the Vite development server
- Preview your widgets at `http://localhost:5173`

## Understanding the Example

Let's examine the example tool in `src/tools/get.tsx`:

```tsx
import { defineTool } from "chapplin/tool";
import z from "zod";

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
		// Your tool logic here
		return {
			content: [{ type: "text", text: "Result description" }],
			structuredContent: { todos: [...] },
		};
	},
	{
		app: ({ toolOutput }) => (
			<div>
				{/* Your UI here */}
			</div>
		),
	},
);
```

### Key Parts:

1. **Tool Name**: `"get"` - identifies the tool
2. **Schemas**: Define input/output types with Zod
3. **Handler**: Async function that processes requests
4. **UI Component**: JSX for rendering the output

## Register Your Tool

In `src/index.ts`, register your tool:

```tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { applyTools } from "chapplin";
import get from "./tools/get.js";

const mcp = new McpServer({
	name: "my-mcp-server",
	version: "1.0.0",
});

applyTools(mcp, [get]);
```
