# Q-02 — Online multiplayer e2e

Role: QA · Depends on: T-18, Q-01 · Size: M

## Goal

Two real browsers play each other through the real server, including reconnects and errors.

## Read first

- `.pi/skills/e2e-testing/SKILL.md`, `docs/UI-CONTRACT.md`
- `e2e/helpers.ts` (reuse; add helpers there)
- `src/shared/protocol.ts` (for message shapes in test 6 only)

## Files

- modify `e2e/helpers.ts`
- create `e2e/online.spec.ts`

## Helpers to add

```ts
/** Two fresh contexts; A creates a room, B joins via the link. Returns pages + code. Both end on screen-placement. */
export async function startOnlineGame(
  browser: Browser,
  via: "link" | "code",
): Promise<{ a: Page; b: Page; code: string; close(): Promise<void> }>;
/** Both press Random + Ready; both end on screen-battle. */
export async function bothReady(a: Page, b: Page): Promise<void>;
/** Alternate: whoever has data-turn="me" fires their next unknown cell, until both show game-over. */
export async function playOnlineUntilGameOver(a: Page, b: Page): Promise<void>;
```

## Tests — e2e/online.spec.ts (desktop project only: `test.skip(testInfo.project.name !== "desktop")`)

1. Create → `room-code` is 6 chars `[A-HJ-NP-Z2-9]`; `room-link` ends with `/?room=<code>`.
2. Join via link and via typed code both reach `screen-placement` on both pages.
3. After A presses Ready, A shows `placement-waiting`; after B presses Ready both show `screen-battle`,
   exactly one page has `turn-indicator[data-turn="me"]`.
4. Full game → one page `data-result="win"`, the other `"lose"`.
5. Rematch: both press `btn-rematch` → both on `screen-placement`.
6. **No cheating**: record every WebSocket frame received by page A (`page.on("websocket")` →
   `ws.on("framereceived")`). For each `state` frame with `view.phase !== "finished"`, assert
   `view.enemyGrid.flat()` contains no `"ship"`.
7. Reconnect: during battle `b.reload()` → A's `status-opponent` goes `disconnected` then `connected`;
   B is back on `screen-battle` with the same own-grid states as before the reload.
8. Leave: B clicks `btn-menu` → A's `status-opponent` becomes `left` and A is routed to `screen-lobby`
   showing the same `room-code`.
9. Errors: joining `ZZZZZZ` → `lobby-error` non-empty; a third context joining a full room → `lobby-error` non-empty.

## Acceptance

`npx playwright test e2e/online.spec.ts` green 3 runs in a row (`--repeat-each=3`) — no flakes.

## Coder notes

Summary: `npm run check` → `Test Files 21 passed (21) / Tests 195 passed (195)`;
`npx playwright test e2e/online.spec.ts --repeat-each=3` → 24 passed / 3 fixme / 30 skipped, no flakes.

- 9 tests as specified; 7 run green on the desktop project, the mobile project skips them
  (`test.skip(testInfo.project.name !== "desktop")`), test 3 is `test.fixme` → BUG-005.
- BUG-005: online Ready reroutes A to `screen-battle`, so `placement-waiting` (UI-CONTRACT line 47)
  is unreachable — routing.ts rule 3 excludes `online && myPlaced`. Body kept whole, nothing weakened.
- BUG-004 filed on the way: the placement screen's `btn-menu` has no click handler (`onExit` never
  called), so leaving only works from the battle header — test 8 therefore does `bothReady` first.
- Helpers added: `createRoom` (test 1 asserts the lobby block _before_ B joins), `watchStatus` +
  `statusLog` (a MutationObserver on the `data-status` attribute inside page A).
- Transient statuses race: "disconnected" and "left" live ~10–30ms, under Playwright's ~100ms
  re-query interval, so `toBeVisible` on them failed 5 of 6 runs; tests 7 and 8 watch the attribute.
- `startOnlineGame` grew an optional 3rd arg `watchA` so test 6 can attach its
  `page.on("websocket")` frame recorder before A navigates.

## Questions for architect

- BUG-004 / BUG-005 are filed in `tasks/bugs/`. `src/client/routing.ts` rule 3 and
  `docs/UI-CONTRACT.md` line 47 disagree about where the placement screen should be once the player
  has placed in online mode; both are contract-adjacent, so I left the decision to the architect and
  only reported it. Test 3 stays `fixme` until that is settled.

## Review
