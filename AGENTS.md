# AGENTS.md

## Goal
- Provide stable, safe operating rules for LLM agents working in this repository.
- Prioritize minimal, correct diffs that match existing patterns.

## Project Summary
- `chapplin` is a framework for building MCP servers with MCP Apps from a single TypeScript codebase.
- Primary users are developers who define MCP tools/resources/prompts and optionally attach UI apps to tools.
- The monorepo includes the runtime framework (`packages/chapplin`), scaffolding CLI (`packages/create-chapplin`), examples, e2e fixtures, and docs website.
- Core workflow: define server features (`defineTool`, `defineResource`, `definePrompt`) and, when needed, define tool UIs with `defineApp`.
- Vite integration in `packages/chapplin/src/vite` handles file collection, virtual modules, dev server behavior, and app build wiring.
- Non-goals for most tasks: redesigning public APIs without request, broad refactors across packages, or changing templates/e2e fixtures unrelated to the requested scope.

## Session Bootstrap
- Read in order:
`README.md` -> `packages/chapplin/README.md` -> `packages/chapplin/src/vite/readme.md` -> target package README.
- Before making edits, write a 3-line summary:
project goal, target area, expected validation commands.
- If requirements are ambiguous, ask before implementing.

## Repo Map
- `packages/chapplin`: core framework package (`defineTool`, `defineApp`, vite plugin, CLI entry).
- `packages/chapplin/src/vite`: vite integration and plugin pipeline.
- `packages/chapplin/dev-ui`: dev UI used by the framework during development.
- `packages/create-chapplin`: project scaffolding tool and templates.
- `examples/*`: runnable sample apps.
- `e2e`: Playwright end-to-end tests and fixture projects.
- `website`: docs site.
- `.github/workflows`: CI rules to mirror locally.

## Working Rules
- Follow existing code style and file layout before introducing new patterns.
- Keep changes scoped to the requested task; avoid opportunistic refactors.
- Do not edit generated or dependency artifacts directly:
`node_modules`, `dist`, `website/.astro`, `e2e/test-results`.
- Avoid destructive git/file commands unless explicitly requested.
- Prefer targeted checks for touched packages first, then broader checks if needed.
- When changing behavior, add or update tests in the nearest relevant package.

## Validation Gates
- Minimum checks for most code changes: `pnpm lint`, `pnpm -r check`
- Build verification: `pnpm -r build`
- Test verification: `pnpm -r test`
- For e2e on a fresh environment, install browsers first: `pnpm -C e2e exec playwright install --with-deps`

## Package-Focused Validation
- If `packages/chapplin/**` changed: `pnpm --filter chapplin build`, `pnpm --filter chapplin test`
- If `packages/create-chapplin/**` changed: `pnpm --filter create-chapplin build`, `pnpm --filter create-chapplin check`
- If `e2e/**` changed: `pnpm --filter chapplin-e2e test:dev:all`, `pnpm --filter chapplin-e2e test:build:all`

## Output Format (for each task)
- Summary: what changed and why.
- Files: list touched paths.
- Validation: commands run + pass/fail.
- Risks: what was not validated and why.

## Subtree Overrides
- If a subdirectory needs specialized rules, add a local `AGENTS.md` there.
- Local `AGENTS.md` should only override what differs from this root file.
