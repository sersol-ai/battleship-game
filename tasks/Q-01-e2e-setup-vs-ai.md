# Q-01 — Playwright setup + vs-computer e2e

Role: QA · Depends on: T-12 · Size: M

## Goal

End-to-end tests of the complete single-player flow in a real browser, written from the UI
contract (not from the source code).

## Read first

- `.pi/skills/e2e-testing/SKILL.md`
- `docs/UI-CONTRACT.md`

## Files

- modify `package.json`: `npm i -D @playwright/test`; add script `"e2e": "playwright test"`
- run `npx playwright install chromium` (if it reports missing system libraries, run
  `npx playwright install-deps chromium` — may need sudo; if you can't, set status `blocked` and say so)
- create `playwright.config.ts`
- create `e2e/helpers.ts`
- create `e2e/vs-ai.spec.ts`

## Spec — playwright.config.ts

```ts
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:8080", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run build && npm start",
    url: "http://localhost:8080/healthz",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

## Spec — e2e/helpers.ts

```ts
export function cell(
  page: Page,
  grid: "grid-placement" | "grid-own" | "grid-enemy",
  x: number,
  y: number,
): Locator;
/** From the menu: choose difficulty, start, press Random, press Ready. Ends on the battle screen. */
export async function startAiGame(
  page: Page,
  opts?: { seed?: number; difficulty?: "easy" | "normal" },
): Promise<void>;
/** Fire at the first "unknown" enemy cell (row-major) whenever it's my turn, until game-over is visible. Returns number of my shots. */
export async function playUntilGameOver(page: Page): Promise<number>;
```

`startAiGame` opens `/?seed=${seed ?? 42}&aidelay=0`. `playUntilGameOver` loop: wait until
`turn-indicator` has `data-turn="me"` OR `game-over` is visible; if game over → return; find the
next unknown cell, click it, `expect(cell).not.toHaveAttribute("data-state", "unknown")`. Safety
cap: 100 shots → throw.

## Tests — e2e/vs-ai.spec.ts

1. Menu shows `btn-play-ai`, `btn-play-online`, `select-difficulty` defaulting to `normal`.
2. Placement: `btn-ready` disabled; `btn-random` → all five `ship-*` have `data-placed="true"`, ready enabled;
   `btn-reset` → all `data-placed="false"`, ready disabled.
3. Manual placement: carrier selected by default; click A1 → cells (0..4,0) `data-state="ship"`;
   `btn-rotate` toggles `data-orientation` H→V; keyboard `r` toggles back.
4. Invalid spot: after carrier at A1, battleship at B2 → `placement-error` non-empty and battleship still `data-placed="false"`.
5. Pick up: click (2,0) → carrier `data-placed="false"`, those cells back to `empty`.
6. Full game (easy, seed 42): `startAiGame` → `turn-indicator` `data-turn="me"`; `playUntilGameOver` →
   `game-over` has `data-result` "win" or "lose"; own grid shows at least one hit/sunk or all enemy ships gone.
7. Firing rules: clicking an already-shot enemy cell does not change anything (count of non-unknown
   enemy cells unchanged) and the AI does not move.
8. Game over → `btn-rematch` → `screen-placement` visible; again to game over → `btn-menu` → `screen-menu`.
9. Same seed twice (two fresh pages, same shots) → identical `data-state` of all own-grid cells after 5 turns.

## Acceptance

- `npx playwright test` green on both projects (desktop, mobile).
- `npm run check` still green (prettier covers e2e files).

## Out of scope

Online play (Q-02).

## Coder notes

## Questions for architect

## Review
