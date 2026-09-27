# AGENTS.md

Browser Battleship (TypeScript, Vite client, Node + ws server). Read this whole file; it is short on purpose.

## Roles

- **Architect** (strong model): owns `docs/`, contract files, `tasks/`. Reviews and merges.
- **Coder** (you, usually): implements ONE task file from `tasks/`. Start with `/task T-XX`.
- **QA**: writes Playwright e2e tests from `docs/UI-CONTRACT.md`, files bugs. Start with `/qa Q-XX`.
- **DevOps**: Docker + CI tasks (`D-XX`). Same workflow as coder.

## Hard rules

1. Work on exactly one task. Touch ONLY the files listed in its "Files" section.
2. Never edit contract files: `src/shared/types.ts`, `src/shared/rules.ts`, `src/shared/protocol.ts`,
   `src/client/controller.ts`, `docs/*`. If the task seems to need it, stop and ask (see below).
3. Read only what the task's "Read first" lists (+ files you edit). Do not explore the repo.
4. `src/shared/**` must not use DOM, Node APIs, or `Math.random()`.
5. No new npm dependencies unless the task says so.
6. Imports use `.ts` extensions: `import { foo } from "./foo.ts";`. Types via `import type`.
7. Never mutate function arguments in `src/shared`. Expected failures return `Result`, never throw.
8. Done means `npm run check` passes (typecheck + prettier + vitest). Run `npm run format` first.

## Workflow per task

1. `git switch main && git pull --ff-only 2>/dev/null; git switch -c task/<ID>`
2. In `tasks/BOARD.md` set the task status to `in-progress`.
3. Implement + tests exactly as the task file specifies.
4. `npm run format && npm run check` — fix until green. Paste the final summary line in the task file.
5. Fill "Coder notes" in the task file (what you did, anything surprising, ≤10 lines).
6. Set status `review` in `tasks/BOARD.md`. Commit: `git add -A && git commit -m "<ID>: <title>"`.
7. Stop. Do not start another task. Do not merge.

## When stuck

If blocked (contract seems wrong, spec is ambiguous, test cannot pass after 3 honest attempts):
write the problem under "Questions for architect" in the task file, set status `blocked`, commit, stop.
Do not work around a contract by adding casts (`as any`, `!`), `@ts-ignore`, or skipping tests.

## Commands

- `npm run dev` — client dev server (http://localhost:5173), proxies `/ws` to :8080
- `npm run dev:server` — Node server with watch (port 8080)
- `npm run check` — everything CI runs (except e2e)
- `npm test -- src/shared/board.test.ts` — one test file
- `npm run build && npm start` — production build on :8080
- `npx playwright test` — e2e (after Q-01 exists)

## Map

`docs/ARCHITECTURE.md` (design), `docs/UI-CONTRACT.md` (data-testid contract), `tasks/BOARD.md` (status).
