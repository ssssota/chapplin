# Framework Deltas

Use this table to align implementation details with the current `chapplin({ target })` value.

## Target Matrix

| Target | `vite.config.ts` plugin setup | TS/JSX runtime assumption | `useApp` import path | UI implementation note |
| --- | --- | --- | --- | --- |
| `react` | `react()` + `chapplin({ target: "react" })` | `jsx: "react-jsx"` | `chapplin/react` | Standard React hooks and JSX patterns |
| `preact` | `preact()` + `chapplin({ target: "preact" })` | `jsx: "react-jsx"`, `jsxImportSource: "preact"` | `chapplin/preact` | Hook usage is effectively parity with React style |
| `solid` | `solid({ ssr: true })` + `chapplin({ target: "solid" })` | `jsx: "preserve"`, `jsxImportSource: "solid-js"` | `chapplin/solid` | Prefer Solid reactive access style (`signals`, `Show`, `For`) |
| `hono` | `chapplin({ target: "hono" })` | `jsx: "react-jsx"`, `jsxImportSource: "hono/jsx/dom"` | `chapplin/hono` | Keep Hono JSX assumptions; avoid React-only API usage |

## Selection Rule

1. Read the `target` value in `vite.config.ts`.
2. Use matching JSX and runtime conventions from the matrix.
3. Import `useApp` only from the corresponding target package.
4. When unsure, copy style from the existing `tools/todos.tsx` in the same project.
