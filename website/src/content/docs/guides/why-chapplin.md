---
title: Why Chapplin?
description: Why Chapplin is useful for building MCP servers and MCP Apps
---

MCP provides the primitives (Tools, Resources, Prompts, MCP Apps), but building a production workflow around them is still a lot of work. Chapplin turns those primitives into a cohesive framework.

## The Problem Without Chapplin

### Single-HTML MCP Apps
MCP Apps (via `@modelcontextprotocol/ext-apps`) require a **single HTML asset** that includes your UI code and styles. Creating that asset by hand means:
- bundling JS/CSS
- inlining assets
- keeping dev and prod builds aligned

### Type Safety Gap
Tool schemas and UI components often drift apart:
- output types are duplicated
- changes require manual sync
- runtime errors slip through

### Boilerplate Everywhere
Registering tools/resources/prompts and wiring a dev preview takes time, and every project re-implements the same pieces.

## What Chapplin Gives You

### File-Based Collection
Drop files into `tools/`, `resources/`, and `prompts/`. Chapplin discovers and registers them automatically.

### End-to-End Type Safety
Types flow from your schema to your UI component:

```tsx
import { defineTool, defineApp } from "chapplin";
import z from "zod";

export const tool = defineTool({
  name: "get_todos",
  config: {
    description: "Get todos",
    inputSchema: {},
    outputSchema: {
      todos: z.array(z.object({ id: z.number(), title: z.string() })),
    },
  },
  async handler() {
    return {
      content: [{ type: "text", text: "ok" }],
      structuredContent: { todos: [{ id: 1, title: "Sample" }] },
    };
  },
});

export const app = defineApp<typeof tool>({
  config: { appInfo: { name: "todos", version: "1.0.0" } },
  ui: (props) => (
    <div>
      {props.output?.structuredContent?.todos.map((todo) => (
        <div key={todo.id}>{todo.title}</div>
      ))}
    </div>
  ),
});
```

### Built-in Vite Integration
Chapplin ships a Vite plugin that:
- bundles MCP Apps into a single HTML file
- generates `chapplin:register` for MCP registration
- provides a dev server with UI preview

## Summary
Chapplin removes the heavy lifting around MCP Apps and provides a clean, type-safe workflow so you can focus on your tools and UI.
