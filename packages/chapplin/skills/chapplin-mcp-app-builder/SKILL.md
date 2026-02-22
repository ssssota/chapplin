---
name: chapplin-mcp-app-builder
description: Build and debug MCP App-enabled tools in existing projects scaffolded by create-chapplin. Use when extending tools/*.tsx with defineTool and defineApp<typeof tool>, wiring structuredContent and _meta for UI data flow, handling runtime differences across react/preact/solid/hono targets, or troubleshooting chapplin preview and host-context behavior.
---

# Chapplin MCP App Builder

## Overview

Use this skill to extend an existing `create-chapplin` project with new MCP App-enabled tools while preserving template conventions and minimal diffs.

## Quick Workflow

1. Confirm the project matches the baseline in `references/project-baseline.md`.
2. Detect the framework target from `vite.config.ts` and `chapplin({ target })`.
3. Implement `defineTool` first, then implement `defineApp<typeof tool>`.
4. Import `useApp` from `chapplin/<target>` only when host actions are needed.
5. Put machine-facing data in `structuredContent` and UI-only payload in `_meta`.
6. Validate with dev preview and tool-call/UI rendering checks.

## Framework/Runtime Selection Rule

1. Read `vite.config.ts`.
2. Resolve `target` from `chapplin({ target: "..." })`.
3. Follow `references/framework-deltas.md` for plugin, JSX runtime, and `useApp` import mapping.
4. Keep existing style patterns in the same target template.

## Implementation Guardrails

- Do not edit generated artifacts such as `dist/`, `.chapplin/types`, or other build outputs.
- Do not change HTTP/STDIO transport structure in `src/index.ts` unless explicitly requested.
- Keep diffs focused on the requested tool/app behavior.
- Match existing naming, schema style, and JSX conventions in the current project.

## Validation Checklist

1. Run `npm run dev` and open the chapplin preview UI.
2. Execute the target tool once and confirm UI renders expected state.
3. Confirm initial empty state is handled (`props.output` may be undefined before first result).
4. Run project checks (typically `npm run build` and any local test/check scripts).
5. Re-check framework-specific assumptions against `references/framework-deltas.md`.

## Reference File Map

- Baseline project shape and registration flow: `references/project-baseline.md`
- Target-specific runtime differences: `references/framework-deltas.md`
- Reusable implementation patterns: `references/implementation-recipes.md`
- Common failures and fixes: `references/troubleshooting.md`
