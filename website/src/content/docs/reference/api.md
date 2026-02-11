---
title: API Reference
description: Chapplin public APIs
---

This page lists the public APIs used in typical Chapplin projects.

## defineTool

```ts
import { defineTool } from "chapplin";

export const tool = defineTool({
  name: "my_tool",
  config: {
    description: "...",
    inputSchema: { ... },
    outputSchema: { ... },
    annotations: { ... },
  },
  async handler(args, extra) {
    return {
      content: [{ type: "text", text: "..." }],
      structuredContent: { ... },
      _meta: { ... },
    };
  },
});
```

- `inputSchema` / `outputSchema` use Zod object shapes
- `_meta` is UI-only data (not sent to the LLM)

## defineApp

```tsx
import { defineApp } from "chapplin";

export const app = defineApp<typeof tool>({
  config: {
    appInfo: { name: "my-app", version: "1.0.0" },
    capabilities: {},
    options: {},
  },
  meta: {
    prefersBorder: true,
  },
  ui: (props) => <div />,
});
```

- `defineApp` **must** be used as `defineApp<typeof tool>`
- `config` is passed to the MCP App constructor

## defineResource

```ts
import { defineResource } from "chapplin";

export const resource = defineResource({
  name: "app-config",
  config: {
    uri: "config://app/settings",
    mimeType: "application/json",
  },
  async handler(uri) {
    return {
      contents: [{ uri: uri.href, text: "{}" }],
    };
  },
});
```

## definePrompt

```ts
import { definePrompt } from "chapplin";

export const prompt = definePrompt({
  name: "code-review",
  config: {
    description: "...",
    argsSchema: { ... },
  },
  handler(args) {
    return {
      messages: [{ role: "user", content: { type: "text", text: "..." } }],
    };
  },
});
```

## Vite Plugin

```ts
import { chapplin } from "chapplin/vite";

chapplin({
  entry: "./src/index.ts",
  target: "react", // react | preact | solid | hono
  toolsDir: "tools",
  resourcesDir: "resources",
  promptsDir: "prompts",
  tsconfigPath: "tsconfig.json",
});
```

## Virtual Module: chapplin:register

```ts
import { register } from "chapplin:register";

register(server);
```

`register(server)` registers all collected tools/resources/prompts (and MCP Apps) onto the given MCP server.

## Runtime Helpers

- `chapplin/react`
- `chapplin/preact`
- `chapplin/solid`
- `chapplin/hono`

### `useApp`

It provides access to the MCP App context.

Check out the example usage in [model-context-protocol/ext-apps](https://github.com/modelcontextprotocol/ext-apps/blob/main/src/app.examples.ts).

```tsx
// Example usage of useApp from chapplin/react
import { useApp } from "chapplin/react";

const app = useApp();
const openUrl = (url: string) => app.openLink({ url });
```
