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

## Review

Fixed: 1, 2 — the two `root` selectors named in "Actual" (`styles.css:1`, and `styles.css:16` inside the media query).

1. `styles.css:1`: `root {` → `:root {`. The twelve custom properties (`--bg` … `--cell`) are now declared on the document root, so every `var(...)` in the file resolves and cells get their real size and colour.
2. `styles.css:16`: `  root {` → `  :root {` inside `@media (max-width: 420px)`, so `--cell: 8.5vw` applies on narrow screens.

Verified in Chromium on this branch after the fix (`npm run build && npm start`, `/?seed=42&aidelay=0`): `--cell=32px`; `[data-testid=grid-placement]` measures 352x352 (was 12x210); placement cell A1 measures 32x32 and clicking it sets `data-state="ship"` with `ship-carrier data-placed="true"`; battle enemy A1 measures 32x32 and clicking it sets `data-state="miss"` and `last-shot` "Enemy: D6 hit". At a 360px viewport `--cell` computes to `8.5vw` (30.6px). `npm run check`: `Test Files 21 passed (21) / Tests 195 passed (195)`.

Not touched, flagging for the architect: `styles.css:231` reads `var(--line)`, which no rule defines, so the game-over border falls back to `currentcolor`. Cosmetic and outside BUG-03.

## Architect re-review

Confirmed by hand on the merged `main`: both selectors are `:root` now (`styles.css:1`, `:16`). `npm run check` green: 21 files / 195 tests. The `var(--line)` finding is real (grepped `styles.css` — no `--line` custom property defined anywhere) but cosmetic and correctly out of scope for this bug; logging it as a follow-up, not reopening this one.

Ran `npx playwright test` to get an independent confirmation beyond the coder's own manual measurements: still **4 passed / 14 skipped**, same as before this fix — the 7 tests are still `test.fixme`'d in `e2e/vs-ai.spec.ts`, so the suite itself doesn't exercise the fix yet (fixing the CSS doesn't un-skip a test marked `fixme`; that needs an explicit code change in the spec file, which is QA's task scope, not this bug's). The fix itself is still correct — traced the causal chain statically: `[data-testid="cell"] { width: var(--cell); height: var(--cell); }` (`styles.css:63-65`) now resolves against a `--cell: 32px` that's actually declared on `:root`, matching the coder's own live-browser measurements above (32x32, was 0x0). **Status: fixed.**

**Follow-up, not done here** (flagging for whoever picks up next, matching Q-01's own coder notes): flip the 7 `test.fixme`s back to `test` in `e2e/vs-ai.spec.ts` and confirm all 18 pass — that's the actual closing step for this bug's test coverage, left to QA rather than done unilaterally by this review.
