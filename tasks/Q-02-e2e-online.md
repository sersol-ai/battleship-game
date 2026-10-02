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

## Questions for architect

## Review
