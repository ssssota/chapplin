---
title: API Reference
description: Complete API reference for Chapplin
---

This page provides a comprehensive reference for all Chapplin APIs.

## Core Functions

### `defineTool()`

Define a tool with schema, handler, and optional UI component.

```tsx
defineTool(
	name: string,
	config: ToolConfig,
	handler: ToolHandler,
	widget?: WidgetConfig
): Tool
```

#### Parameters

**`name`** (string)
- Unique identifier for the tool
- Used in MCP protocol and widget generation
- Use kebab-case or snake_case

**`config`** (ToolConfig)
```typescript
{
	title?: string;           // Human-readable title
	description?: string;     // Tool description
	inputSchema?: ZodShape;   // Input validation schema
	outputSchema?: ZodShape;  // Output validation schema
	annotations?: ToolAnnotations;
	_meta?: Record<string, unknown>;
}
```

**`handler`** (ToolHandler)
```typescript
async (input, extra) => {
	return {
		content: Array<ContentBlock>;
		structuredContent: OutputData;
		_meta?: Record<string, unknown>;
	};
}
```

**`widget`** (WidgetConfig, optional)
```typescript
{
	name?: string;           // Widget name (defaults to tool name)
	_meta?: ComponentResourceMeta;
	app: (props: OpenAiGlobals) => JSXElement;
}
```

#### Returns

`Tool` - A function that registers the tool with an MCP server

#### Example

```tsx
import { defineTool } from "chapplin/tool";
import z from "zod";

export default defineTool(
	"get-user",
	{
		title: "Get User",
		description: "Fetch user information by ID",
		inputSchema: {
			userId: z.string(),
		},
		outputSchema: {
			user: z.object({
				id: z.string(),
				name: z.string(),
				email: z.string(),
			}),
		},
	},
	async ({ userId }) => {
		const user = await fetchUser(userId);
		return {
			content: [{ type: "text", text: `Found user: ${user.name}` }],
			structuredContent: { user },
		};
	},
	{
		app: ({ toolOutput }) => (
			<div>
				<h1>{toolOutput?.user.name}</h1>
				<p>{toolOutput?.user.email}</p>
			</div>
		),
	},
);
```

---

### `applyTools()`

Register multiple tools with an MCP server.

```typescript
applyTools(
	server: McpServer,
	tools: Tool[]
): void
```

#### Parameters

**`server`** (McpServer)
- MCP server instance

**`tools`** (Tool[])
- Array of tools created with `defineTool()`

#### Example

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { applyTools } from "chapplin";
import getUser from "./tools/get-user.js";
import createUser from "./tools/create-user.js";

const mcp = new McpServer({
	name: "my-server",
	version: "1.0.0",
});

applyTools(mcp, [getUser, createUser]);
```

---

## Vite Plugin

### `chapplin()`

Vite plugin for Chapplin.

```typescript
chapplin(options?: ChapplinOptions): Plugin[]
```

#### Options

```typescript
type ChapplinOptions = {
	toolsDir?: string;  // Tools directory (default: "./src/tools")
}
```

#### Example

```typescript
// vite.config.ts
import { chapplin } from "chapplin/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		chapplin({
			toolsDir: "./src/tools",
		}),
	],
});
```
