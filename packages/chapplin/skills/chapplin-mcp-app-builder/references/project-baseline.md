# Project Baseline

Use this file to quickly decide whether the current repository is a `create-chapplin` style project and where to edit.

## Quick Eligibility Check

Confirm all of the following exist:

- `tools/`
- `resources/`
- `prompts/`
- `src/index.ts`
- `vite.config.ts`

If this shape is missing, ask for project context before implementing.

## Expected Layout

```text
<project-root>/
├── tools/
│   └── *.ts or *.tsx
├── resources/
│   └── *.ts
├── prompts/
│   └── *.ts
├── src/
│   └── index.ts
├── vite.config.ts
└── tsconfig.json
```

## `chapplin:register` Registration Flow

`src/index.ts` imports:

```ts
import { register } from "chapplin:register";
```

Then call `register(server)` on each new `McpServer` instance before connecting a transport. This call auto-registers collected tools/resources/prompts (including tools with `defineApp`).

## `src/index.ts` Transport Pattern (HTTP + STDIO)

Typical template behavior:

1. Resolve mode from CLI args (`http` default, `stdio` optional).
2. In STDIO mode:
   - Create `McpServer` -> call `register(server)` -> connect `StdioServerTransport`.
3. In HTTP mode:
   - Expose `/mcp`, create a fresh `McpServer` per request, call `register(server)`, connect `StreamableHTTPTransport`, and return `transport.handleRequest(...)`.

Do not alter this transport structure unless the user explicitly asks for transport changes.
