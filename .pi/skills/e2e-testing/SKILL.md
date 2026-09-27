---
name: e2e-testing
description: Playwright end-to-end testing conventions for this Battleship repo. Use when writing or fixing tests under e2e/, running Playwright, or filing bug reports as QA.
---

# E2E testing (Playwright)

## Setup facts

- Specs live in `e2e/*.spec.ts`. Config: `playwright.config.ts` (created by Q-01).
- The config starts the app with `npm run build && npm start` (port 8080) via `webServer`.
- Chromium only. Run: `npx playwright test`, one file: `npx playwright test e2e/vs-ai.spec.ts`.
- Debug a failure: `npx playwright test --reporter=line`, then read `test-results/**/error-context.md`.

## Selectors

- ONLY `data-testid` + the data attributes in `docs/UI-CONTRACT.md`. Never CSS classes or text.
- Use `page.getByTestId("btn-ready")`. Cells:
  `page.getByTestId("grid-enemy").locator('[data-testid=cell][data-x="3"][data-y="5"]')`
- Assert state through attributes: `await expect(cell).toHaveAttribute("data-state", "miss")`.

## Determinism

- Always open pages with `?seed=<fixed int>&aidelay=0` for vs-AI tests.
- Never `page.waitForTimeout`. Wait on an attribute/visibility with `expect(...).toHaveAttribute(...)`.

## Online (two players)

- Use two contexts: `const a = await browser.newContext(); const b = await browser.newContext();`
- Player A creates a room, reads `room-code` text, player B opens `/?room=<code>`.

## Bug reports

When the app contradicts the task or UI contract, create `tasks/bugs/B-<next number>-<slug>.md`:

```
# B-00N — <one line>
Found by: <Q task id>   Severity: blocker | major | minor
## Steps
1. ...
## Expected (cite UI-CONTRACT.md or task)
## Actual
## Evidence
test name, error excerpt (≤20 lines)
```

Add a row to the Bugs table in `tasks/BOARD.md` with status `todo`.
