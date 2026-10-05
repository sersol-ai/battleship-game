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
