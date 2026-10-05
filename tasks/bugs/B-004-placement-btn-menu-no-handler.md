# B-004 — placement screen `btn-menu` is a dead button: no click handler, `onExit` never called

Found by: Q-02 Severity: blocker

## Steps

1. `npm run build && npm start`, open `http://localhost:8080/?seed=42&aidelay=0` in browser A
2. A: `btn-play-online` → `btn-create-room`; read `room-code`; open `/?room=<code>` in browser B
3. Both are on `screen-placement`. Click `[data-testid=btn-menu]` on **B**
4. Compare with the same click once both have pressed `btn-random` + `btn-ready` (battle screen)

## Expected (cite UI-CONTRACT.md or task)

`docs/UI-CONTRACT.md` §Screens: "`btn-menu` | inside game-over, **and in the placement/battle
header**; → back to menu". `tasks/Q-02-e2e-online.md` test 8 exercises leaving through `btn-menu`.

## Actual

Nothing happens: B stays on `screen-placement`, its URL is still `/?room=<code>`, and A is
unchanged (no `status-opponent` change, no reroute).

`src/client/screens/placement.ts` creates the button (lines 95–98: `data-testid="btn-menu"`,
text `Menu`, appended to the header) but never attaches a click handler to it. The file's only
click listeners are on the ship buttons (106), `btn-rotate` (116), `btn-random` (125), `btn-reset`
(138) and `btn-ready` (155). `PlacementDeps.onExit` (declared at line 75, supplied by
`src/client/main.ts`) is never called from the placement screen — grepping `onExit` in the file
yields the type declaration and nothing else.

`src/client/screens/battle.ts:76` does the same thing correctly
(`headerMenu.addEventListener("click", ...)`), which is why leaving works from the battle screen.

## Evidence

Manual Chromium run on this branch (A creates, B joins, both on placement, B clicks `btn-menu`):

```
--- B placement: http://localhost:8080/?room=XS4XRU
screen-placement | btn-menu = "Menu" | ... | btn-ready = "Ready" | placement-waiting(hidden)
--- B after click: http://localhost:8080/?room=XS4XRU
screen-placement | btn-menu = "Menu" | ... | btn-ready = "Ready" | placement-waiting(hidden)
```

A's page is likewise still `screen-placement` 2s later. The identical click on the battle-screen
header does work: A's `status-opponent` flips to `left` and A is rerouted to `screen-lobby` showing
the same `room-code` (that is what Q-02 test 8 now covers).

## Review

The "Review" section was empty when this fix started, so the item numbers below are the two claims
made in "Actual" (dead button / `onExit` never called), which is the whole defect.

Fixed: 1, 2

1. `src/client/screens/placement.ts:98` — the `btn-menu` created at lines 95–97 now gets the click
   handler it never had: `menuButton.addEventListener("click", () => { deps.onExit(); });`, the same
   shape `src/client/screens/battle.ts:76` uses for the battle header. The button is no longer dead:
   the click reaches `PlacementDeps.onExit` (line 75), which `src/client/main.ts` supplies as
   `exitToMenu`.
2. `deps.onExit` is now called from the placement screen, which was the second half of the claim.
   `exitToMenu` unsubscribes and disposes the controller (online: sends `leave`, so the other player's
   `status-opponent` flips to `left` and `routing.ts` reroutes them to `screen-lobby` with the same
   `room-code`), sets `controller = null`, drops the `?room=<code>` query via
   `history.replaceState(null, "", "/")`, and mounts `screen-menu`.

Verified end to end on this branch with Playwright (fresh `npm run build && npm start`, both
projects, desktop + mobile): A creates a room, B opens `/?room=<code>`, both reach
`screen-placement`; clicking `[data-testid=btn-menu]:visible` on B leaves `screen-placement` and
shows `screen-menu` (`select-difficulty`, `btn-play-ai`, `btn-play-online`) with B's URL now
`http://localhost:8080/` (was `/?room=<code>`), and A is rerouted to `screen-lobby` showing the same
`room-code`. The temporary spec that proved this was deleted after the run; the whole e2e suite
(`npx playwright test`, 27 tests over both projects) then runs 25 passed / 10 skipped / 1 failed,
and that one failure is the pre-existing flaky mobile run of Q-01's "the same seed replays
identically on two fresh pages" — re-running `e2e/vs-ai.spec.ts` alone gives 18/18 passed, and the
failure is unrelated to this change (nothing here touches firing or RNG).

Unit test added: `src/client/screens/placement.test.ts:302` — "btn-menu in the header calls
onExit" mounts the screen, clicks `[data-testid="btn-menu"]` and asserts the `onExit` dep fired
once. `npm run format && npm run check`: typecheck clean, prettier clean, `Test Files 21 passed
(21) / Tests 196 passed (196)` (195 before, +1 new test).

Coder notes: the fix is one handler; nothing else in `placement.ts` needed to change. Two things
surprised me while verifying. (a) Playwright's `webServer` has
`reuseExistingServer: !process.env.CI`, and a `node dist/server/index.js` from an earlier session
was still holding :8080, so the first verification run served a **stale** `dist/client` without the
fix and the click did nothing — I killed that process and re-ran before believing the failure.
Anyone reproducing this bug should check `lsof -i:8080` first. (b) BUG-05 is still open: pressing
`btn-ready` online reroutes to `screen-battle` (`src/client/routing.ts` rules 2/3), so
`placement-waiting` stays unreachable. That is a different file and a different bug; leaving it
alone here.
