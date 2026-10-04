# T-12 — Battle screen

Role: coder · Depends on: T-11 · Size: L

## Goal

Two boards, fire by clicking the enemy board, turn indicator, remaining ships, last shot,
game-over dialog with rematch/menu. Works for both AI and online controllers.

## Read first

- `docs/UI-CONTRACT.md` sections "Battle screen" and "Grid"
- `src/client/controller.ts`, `src/client/ui/grid.ts` (exports), `src/client/main.ts`
- `src/shared/types.ts` (PlayerView), `src/shared/view.ts` (formatCoord), `src/shared/rules.ts`

## Files

- create `src/client/screens/battle.ts`
- create `src/client/screens/battle.test.ts`
- modify `src/client/main.ts` (replace the battle placeholder)
- modify `src/client/styles.css` (append `/* === battle (T-12) === */`)

## Spec

```ts
import type { GameController } from "../controller.ts";
export interface BattleDeps {
  controller: GameController;
  onExit(): void;
}
export function mountBattle(root: HTMLElement, deps: BattleDeps): () => void;
```

Layout: `<section data-testid="screen-battle">`:

- header: `turn-indicator`, `btn-menu` (header copy — see note below), and when
  `snapshot.mode === "online"`: `status-opponent` and `status-connection` (text + `data-status`).
- boards row: `grid-own` ("Your fleet", no click handler, always disabled) and `grid-enemy`
  ("Enemy waters"). Side by side ≥ 720px, stacked below (flex-wrap).
- `my-remaining` / `enemy-remaining`: `<ul data-count="n">` with ship names.
- `last-shot`: `<p>`; text `"You: B7 hit"`, `"Enemy: C3 miss"`, `"You: D4 sunk cruiser"`; empty if null.
  (`by === view.me` → "You", else "Enemy".)
- error line: `snapshot.error` text (class `error`), hidden if null.
- `game-over`: a `<div role="dialog">` overlay, hidden unless `phase === "finished"`;
  `data-result = winner === me ? "win" : "lose"`; heading "You win!" / "You lose"; `btn-rematch`
  ("Play again") and a second `btn-menu`.
  **testid note**: two elements with `btn-menu` exist; the dialog one must be the only VISIBLE one
  while the dialog is open — hide the header one when finished.

Behaviour on each snapshot:

- `own.update(view.myGrid)`, `enemy.update(view.enemyGrid)`.
- `turn-indicator`: `data-turn` = `"none"` if phase ≠ playing, else `"me"`/`"enemy"`; text
  "Your turn" / "Opponent's turn" / "Game over".
- enemy grid disabled unless `view.isMyTurn`.
- Click enemy cell c: only if `view.isMyTurn` and `view.enemyGrid[c.y][c.x] === "unknown"` →
  `controller.fire(c)`. Otherwise do nothing.
- `btn-rematch` → `controller.rematch()`; then change its text to "Waiting for opponent…" and
  disable it (for AI, the controller immediately switches phase and main routes to placement).
- `btn-menu` (either) → `deps.onExit()`.

main.ts: route `"battle"` → `mountBattle(app, { controller, onExit: exitToMenu })`.

## Tests (battle.test.ts) — happy-dom + fake controller (same pattern as placement.test.ts)

1. isMyTurn true → clicking an unknown enemy cell calls fire with its coord; clicking a "miss" cell doesn't.
2. isMyTurn false → click does nothing; turn-indicator data-turn "enemy".
3. last-shot text for a sunk result by me: "You: A1 sunk destroyer" (use lastShot with sunkShip).
4. phase finished + winner me → game-over visible with data-result "win"; rematch click calls rematch.
5. mode online → status-opponent present with data-status; mode ai → absent.
6. remaining lists: data-count matches array length.

## Acceptance

- `npm run format && npm run check` green.
- Manual: full game vs computer in `npm run dev`, rematch returns to placement, menu returns to menu.

## Out of scope

Animations/sounds (maybe later task).

## Coder notes

- `mountBattle(root, deps)` builds `screen-battle` + header (`turn-indicator`, `btn-menu`) + `grid-own`/`grid-enemy` via the real T-10 `mountGrid` (own grid mounted without `onCellClick`, enemy grid clickable only when `view.isMyTurn`), plus `my-remaining`/`enemy-remaining` `<ul data-count>`, `last-shot`, error line, and a `game-over` `div role="dialog"` with `btn-rematch` + a second `btn-menu`.
- Header `btn-menu` gets `hidden` while `game-over` is shown (contract: only ONE `btn-menu` visible at a time); the dialog copy stays live.
- `btn-rematch` click → `controller.rematch()` then `disabled` + "Waiting for opponent…"; re-enabled on the next render.
- `last-shot` text: `You: A1 sunk destroyer` / `Enemy: B2 miss` — "You" when `lastShot.by === view.me`; `formatCoord` from `view.ts`.
- Clicking a cell that is not `unknown` is ignored client-side (no `fire` call), plus the grid's own `clickable()` gate.
- `main.ts`: replaced T-11's `mountBattlePlaceholder` with `mountBattleScreen()` using `BattleDeps { controller, onExit: exitToMenu }`; battle mount is a no-op if no controller is live.
- `styles.css`: added `/* === battle (T-12) === */` — boards side-by-side ≥720px (stacked below), `game-over` fixed overlay, `hidden` menu copy hidden.
- Surprising: `ShotResult` has no `by` field (that lives on `PlayerView.lastShot`), so `shotText` takes the whole `lastShot` object, not a `ShotResult`.
- `npm run check` green: 21 files / 195 tests (9 new battle tests).

## Questions for architect

## Review

No real bugs. Two non-blocking nitpicks, fix at your discretion (not worth a round-trip on their own):

- `errorLine`'s `hidden` attribute is never set/cleared — relies on empty text content instead. Harmless; no `UI-CONTRACT.md` testid depends on `hidden` for this element, but inconsistent with the `btn-menu`/`game-over` pattern elsewhere in this same file.
- Unused `shot` local around line 206.

**Status: done.**
