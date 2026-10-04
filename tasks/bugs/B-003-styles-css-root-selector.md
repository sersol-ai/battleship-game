# B-003 — styles.css declares its CSS variables on `root`, not `:root`

Found by: Q-01 Severity: blocker

## Steps

1. `npm run build && npm start`, open `http://localhost:8080/?seed=42&aidelay=0`
2. Menu: click `btn-play-ai` → placement screen → click `btn-random` → click `btn-ready` → battle screen
3. Try to fire at enemy cell A1: `[data-testid=grid-enemy] [data-testid=cell][data-x="0"][data-y="0"]`
4. Same on the placement screen: click `[data-testid=grid-placement] [data-testid=cell][data-x="0"][data-y="0"]`

## Expected (cite UI-CONTRACT.md or task)

- `tasks/T-08-client-shell.md` ("Files" / spec): "`styles.css`: CSS variables on `:root`" and
  "`@media (max-width: 420px) { :root { --cell: 8.5vw; } }`".
- `docs/UI-CONTRACT.md` §Grid: `cell` is a `<button>` with `data-x`/`data-y` 0..9 and `data-state`;
  enemy cells are clickable on my turn. Q-01 requires a green e2e run of the whole vs-AI flow, which
  is exactly this clicking.

## Actual

`src/client/styles.css` line 1 is `root {` and line 16 (inside the media query) is `  root {`. No
element named `root` exists in the document, so `--bg`, `--panel`, `--text`, `--accent`, `--water`,
`--ship`, `--miss`, `--hit`, `--sunk`, `--cell` are all undefined. Consequences:

- every cell computes to `width: 0, height: 0` (the grid box measures 12x210 instead of ~340x340),
  so no cell can be clicked, hovered, or seen;
- no colour is applied anywhere (all `var(...)` colours are invalid at computed-value time).

## Evidence

`manual placement: carrier is selected by default, A1 places it, rotate toggles [desktop]`
and 6 more tests, both projects:

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByTestId('grid-placement').locator('[data-testid=cell][data-x="0"][data-y="0"]')
    - locator resolved to <button data-x="0" data-y="0" class="cell" data-testid="cell" data-state="empty"></button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
      - waiting 20ms
    54 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
      - waiting 500ms
```

In-page measurement on the placement screen: cell `getBoundingClientRect()` = `x 22, y 359, w 0, h 0`;
`[data-testid=grid-placement]` = `w 12, h 210`.

Proof that this is the only cause: changing line 1 and line 16 to `:root` (the T-08 spec) makes the
same cells measure 32x32 and all 18 e2e runs (9 tests x desktop/mobile) pass in 55s. The repo was
not modified: the change was reverted before committing.
