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
