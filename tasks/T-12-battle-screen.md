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

## Questions for architect

## Review
