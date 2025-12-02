---
title: Framework Integration
description: Integrate Chapplin with different server and UI frameworks
---

Chapplin is framework-agnostic and can be integrated with various server frameworks and UI libraries. This guide covers the most popular options.

## Server Frameworks

### Hono (Recommended)

Hono is a fast, lightweight framework that works great with Chapplin.

#### Installation

```bash
npm install hono @hono/mcp @hono/node-server
```

#### Setup

```typescript
// src/index.ts
import { StreamableHTTPTransport } from "@hono/mcp";
import { serve } from "@hono/node-server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { applyTools } from "chapplin";
import { Hono } from "hono";
import getTodos from "./tools/get-todos.js";

const app = new Hono();

// Create MCP server
const mcp = new McpServer({
	name: "my-mcp-server",
	version: "1.0.0",
});

// Register tools
applyTools(mcp, [getTodos]);

const transport = new StreamableHTTPTransport();
// MCP endpoint
app.all("/mcp", async (c) => {
	if (!mcp.isConnected()) await mcp.connect(transport);
	return transport.handleRequest(c);
});

// Start server
serve(app, console.log);
```

### Express

Traditional Node.js framework with extensive middleware ecosystem.

#### Installation

```bash
npm install express @modelcontextprotocol/sdk
npm install -D @types/express
```

#### Setup

```typescript
// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { applyTools } from "chapplin";
import express from "express";
import getTodos from "./tools/get-todos.js";

const app = express();
app.use(express.json());

// Create MCP server
const mcp = new McpServer({
	name: "my-mcp-server",
	version: "1.0.0",
});

applyTools(mcp, [getTodos]);

// MCP endpoint
app.all("/mcp", async (req, res) => {
	const transport = new StreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
	});
	await mcp.connect(transport);
	await transport.handleRequest(req, res, req.body);
});

app.listen(3000, console.log);
```

## UI Libraries

### React

The most popular UI library with a large ecosystem.

#### Installation

```bash
npm install react react-dom
npm install -D @types/react @types/react-dom
```

#### Tool Configuration

```tsx
// src/tools/get-todos.tsx
import { defineTool } from "chapplin/tool-react";
import z from "zod";

export default defineTool(
	"get-todos",
	{
		outputSchema: {
			todos: z.array(
				z.object({
					id: z.number(),
					title: z.string(),
					completed: z.boolean(),
				})
			),
		},
	},
	async () => {
		// Handler logic
	},
	{
		app: ({ toolOutput }) => (
			<div>
				<h1>Todos</h1>
				<ul>
					{toolOutput?.todos.map((todo) => (
						<li key={todo.id}>{todo.title}</li>
					))}
				</ul>
			</div>
		),
	},
);
```

#### TypeScript Config

```json
{
	"compilerOptions": {
		"jsx": "react-jsx",
		"jsxImportSource": "react" // optional (default is "react")
	}
}
```

### Preact

Lightweight React alternative with the same API.

#### Installation

```bash
npm install preact
```

#### Tool Configuration

```tsx
// src/tools/get-todos.tsx
import { defineTool } from "chapplin/tool-preact";
import z from "zod";

export default defineTool(
	"get-todos",
	{
		outputSchema: {
			todos: z.array(
				z.object({
					id: z.number(),
					title: z.string(),
					completed: z.boolean(),
				})
			),
		},
	},
	async () => {
		// Handler logic
	},
	{
		app: ({ toolOutput }) => (
			<div>
				<h1>Todos</h1>
				<ul>
					{toolOutput?.todos.map((todo) => (
						<li key={todo.id}>{todo.title}</li>
					))}
				</ul>
			</div>
		),
	},
);
```

#### TypeScript Config

```json
{
	"compilerOptions": {
		"jsx": "react-jsx",
		"jsxImportSource": "preact"
	}
}
```

### Hono JSX

Built-in JSX support from Hono, no additional libraries needed.

#### Installation

```bash
npm install hono
```

#### Tool Configuration

```tsx
// src/tools/get-todos.tsx
import { defineTool } from "chapplin/tool-hono";
import z from "zod";

export default defineTool(
	"get-todos",
	{
		outputSchema: {
			todos: z.array(
				z.object({
					id: z.number(),
					title: z.string(),
					completed: z.boolean(),
				})
			),
		},
	},
	async () => {
		// Handler logic
	},
	{
		app: ({ toolOutput }) => (
			<div>
				<h1>Todos</h1>
				<ul>
					{toolOutput?.todos.map((todo) => (
						<li key={todo.id}>{todo.title}</li>
					))}
				</ul>
			</div>
		),
	},
);
```

#### TypeScript Config

```json
{
	"compilerOptions": {
		"jsx": "react-jsx",
		"jsxImportSource": "hono/jsx"
	}
}
```
