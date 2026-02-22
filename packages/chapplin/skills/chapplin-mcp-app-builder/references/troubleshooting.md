# Troubleshooting

Use this guide for common failures when adding MCP App-enabled tools in chapplin projects.

## 1) Missing Generic on `defineApp<typeof tool>`

### Symptom

`props.input` / `props.output` typing is weak, or TypeScript reports a `defineApp` usage error.

### Likely cause

`defineApp` was called without `typeof tool`.

### Fix steps

1. Locate the app declaration.
2. Change `defineApp({ ... })` to `defineApp<typeof tool>({ ... })`.
3. Re-check typed access in `props.output?.structuredContent` and `props.output?._meta`.

### Verification step

Run project type checks and confirm no `defineApp` generic error remains.

## 2) Wrong Runtime Import for `useApp`

### Symptom

Runtime errors or unresolved import for `useApp`.

### Likely cause

Import path does not match `chapplin({ target })`.

### Fix steps

1. Read `vite.config.ts` and identify target.
2. Use one of:
   - `chapplin/react`
   - `chapplin/preact`
   - `chapplin/solid`
   - `chapplin/hono`
3. Remove mismatched runtime imports.

### Verification step

Run dev server and trigger the host action (for example, `openLink`) from UI.

## 3) UI Renders Nothing Before First Tool Result

### Symptom

Component appears empty or crashes on first render.

### Likely cause

UI assumes `props.output` always exists.

### Fix steps

1. Add an initial fallback branch.
2. Use optional chaining for `props.output?.structuredContent`.
3. Render loading/empty state until first tool result arrives.

### Verification step

Load preview before calling the tool and confirm fallback UI appears safely.

## 4) Schema/UI Path Mismatch

### Symptom

Data exists in handler return but UI reads wrong field path.

### Likely cause

`outputSchema`, `structuredContent`, and UI access path diverged.

### Fix steps

1. Compare `outputSchema` keys with handler `structuredContent` keys.
2. Align UI reads with `props.output?.structuredContent`.
3. Keep UI-only fields in `_meta` and read from `props.output?._meta`.

### Verification step

Call tool in preview and confirm expected values render from the correct path.

## 5) Preview UI Works but MCP Call Fails

### Symptom

App shell loads, but tool execution fails or returns registration/route errors.

### Likely cause

`src/index.ts` registration or `/mcp` route wiring is incorrect.

### Fix steps

1. Confirm `import { register } from "chapplin:register";` exists.
2. Confirm `register(server)` is called before transport connect in both HTTP/STDIO flows.
3. Confirm HTTP mode exposes `/mcp` and returns `transport.handleRequest(...)`.

### Verification step

Restart dev server and call the tool from preview; confirm MCP response and UI update both succeed.
