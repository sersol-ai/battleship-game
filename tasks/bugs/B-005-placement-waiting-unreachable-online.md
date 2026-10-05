# B-005 — `placement-waiting` is never visible online: pressing Ready reroutes to the battle screen

Found by: Q-02 Severity: blocker

## Steps

1. `npm run build && npm start`, open `http://localhost:8080/?seed=42&aidelay=0` in browser A
2. A: `btn-play-online` → `btn-create-room`; open `/?room=<code>` in browser B
3. Both press `btn-random` (so `btn-ready` is enabled)
4. A clicks `[data-testid=btn-ready]` — B has not pressed Ready yet
5. Look for `[data-testid=placement-waiting]` on A

## Expected (cite UI-CONTRACT.md or task)

`docs/UI-CONTRACT.md` §Screens line 47: "`placement-waiting` | **visible after Ready while waiting
for opponent**". `tasks/Q-02-e2e-online.md` test 3 asserts exactly that: "After A presses Ready, A
shows `placement-waiting`".

## Actual

A's page is no longer the placement screen at all: it is rerouted to `screen-battle`, so the
placement screen (and its `placement-waiting` element) is unmounted and the element can never be
seen. `src/client/routing.ts` never returns `"placement"` once `myPlaced` is true in online mode:
rule 2 (line 14) requires `!view.myPlaced`, and rule 3 (line 32) is guarded by
`!(mode === "online" && view.myPlaced)`. Everything else falls through to `return "battle"` (line
42). `src/client/screens/placement.ts` only unhides `placement-waiting` while the screen is mounted
(lines 258–264), so the contract element is unreachable in online play.

## Evidence

Manual Chromium run on this branch, A's DOM right after A clicks `btn-ready` (B still un-ready):

```
--- A after A ready: http://localhost:8080/?seed=42&aidelay=0
screen-battle | turn-indicator:none | btn-menu | status-opponent:connected | status-connection:open
| grid-own | grid-enemy | my-remaining | enemy-remaining | last-shot | game-over:true | btn-rematch | btn-menu
```

No `screen-placement`, no `placement-waiting`. (Before the click the same page lists
`screen-placement | ... | btn-ready | placement-waiting(hidden)`.)

Playwright's own report of Q-02 test 3, both projects:

```
Error: expect(locator).toBeVisible() failed
Locator: getByTestId('placement-waiting')
Timeout: 5000ms
Error: element(s) not found
```

## Review

The "Review" section was empty when this fix started, so the item numbers below are the three
claims made in "Actual", which together are the whole defect.

Fixed: 1, 2, 3

1. `src/client/routing.ts:27` — rule 3 lost its `!(mode === "online" && view.myPlaced)` guard, so
   any view still in `phase === "placing"` now routes to `"placement"`, online as well as vs AI.
   `src/client/main.ts` only remounts when `routeFor(snapshot)` changes, so pressing `btn-ready`
   online keeps the placement screen mounted and `[data-testid=placement-waiting]` stays in the DOM
   until the match moves to `phase === "playing"` (then `routeFor` returns `"battle"`).
2. Same file, rule 2 (`src/client/routing.ts:13`): the condition is now
   `s.opponent === "left" || (s.opponent === "waiting" && !view.myPlaced)`. The `!view.myPlaced`
   half is what used to push an already-placed player past rule 2 down to `return "battle"`; it is
   dropped for `opponent === "left"` so a player waiting for an opponent who leaves goes back to
   `screen-lobby` with the same `room-code` (the same shape the battle-screen leave has, which Q-02
   test 8 covers), while a `waiting` opponent plus `myPlaced === true` now falls through to rule 3
   and stays on `screen-placement`.
3. No change was needed in `src/client/screens/placement.ts`: it already unhides
   `placement-waiting` in `refresh()` once the subscribe callback sets `waiting = true`
   (`snapshot.view !== null && snapshot.view.myPlaced`) and re-disables `btn-ready` while waiting.
   The element was unreachable only because `routing.ts` unmounted the screen around it; with item
   1 fixed it renders.

Verified end to end on this branch with Playwright (fresh `npm run build && npm start`, both
projects): a temporary spec with the body of Q-02 test 3 — A creates a room, B opens
`/?room=<code>`, both press `btn-random`, A presses `btn-ready` — now passes: A still shows
`screen-placement`, `placement-waiting` is visible and `btn-ready` is disabled; after B presses
`btn-ready` both show `screen-battle` and exactly one of the two pages has `data-turn="me"`. The
temporary spec was deleted after the run; the whole e2e suite (`npx playwright test`, 36 tests over
both projects) then runs 26 passed / 10 skipped / 0 failed, the skips being Q-02's online tests on
the mobile project plus its own `test.fixme` for this bug (QA un-marks that, not this task).

Unit tests: `src/client/routing.test.ts` — the existing "online placing, player already placed"
case now expects `"placement"` (line 52; it asserted `"battle"`, i.e. the buggy behaviour, before),
and three cases were added: line 66 "online placing, already placed, opponent left → lobby", line
79 "online placing, already placed, opponent connected → placement", line 92 "online playing
(already placed) still routes to battle". `npm run format && npm run check`: typecheck clean,
prettier clean, `Test Files 21 passed (21) / Tests 199 passed (199)` (196 before, +3 new).

Coder notes: one guard removed plus one condition reshaped in `routing.ts`; nothing else touched.
Two things surprised me. (a) This branch is based on `task/B-04`, not on `main`: the B-005 report
that is this task's spec only exists in the Q-02 lineage (`4046a4b`), which `task/B-04` sits on, so
branching off `main` left no task file and no BUG-05 row in `tasks/BOARD.md` to update. (b) Rule 2
of the old code sent an online player who had not placed yet back to the lobby whenever the
opponent was `waiting` — that is why the e2e helpers only see `screen-placement` once both seats
are connected; I kept that behaviour for the not-placed case and only extended it to `left`.
