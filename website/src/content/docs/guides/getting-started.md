---
title: Getting Started
description: Create your first MCP server and MCP App with Chapplin
---

Welcome to Chapplin. This guide walks you through a minimal MCP server with a UI-enabled tool.

## Create a Project

```bash
npm create chapplin@latest
```

Then install dependencies and start the dev server:

```bash
cd my-chapplin-app
npm install
npm run dev
```

## Project Structure

```
my-chapplin-app/
├── tools/
│   └── todos.tsx
├── resources/
├── prompts/
├── src/
│   └── index.ts
├── vite.config.ts
└── tsconfig.json
```

## Vite Config

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { chapplin } from "chapplin/vite";
import react from "@vitejs/plugin-react"; // swap for preact/solid/hono

export default defineConfig({
  plugins: [
    react(),
    chapplin({
      entry: "./src/index.ts",
      target: "react",
    }),
  ],
});
```

## MCP Server Entry

```ts
// src/index.ts
import { register } from "chapplin:register";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPTransport } from "@hono/mcp";
import { Hono } from "hono";

const app = new Hono();

app.all("/mcp", async (c) => {
  const server = new McpServer({ name: "my-server", version: "1.0.0" });
  register(server);
  const transport = new StreamableHTTPTransport();
  await server.connect(transport);
  return transport.handleRequest(c);
});

export default app;
```

## Define a Tool + UI

```tsx
// tools/todos.tsx
import { defineTool, defineApp } from "chapplin";
import z from "zod";

export const tool = defineTool({
  name: "get_todos",
  config: {
    description: "Get todos",
    inputSchema: {
      filter: z.enum(["all", "completed", "pending"]).default("all"),
    },
    outputSchema: {
      todos: z.array(
        z.object({ id: z.number(), title: z.string(), completed: z.boolean() }),
      ),
    },
  },
  async handler(args) {
    return {
      content: [{ type: "text", text: `filter: ${args.filter}` }],
      structuredContent: { todos: [] },
    };
  },
});

export const app = defineApp<typeof tool>({
  config: { appInfo: { name: "todos", version: "1.0.0" } },
  ui: (props) => (
    <div>
      <h1>Todos</h1>
      {props.output?.structuredContent?.todos.map((todo) => (
        <div key={todo.id}>{todo.title}</div>
      ))}
    </div>
  ),
});
```

## Preview the UI

Run the dev server and open `http://localhost:5173/` to use the built-in preview UI.
