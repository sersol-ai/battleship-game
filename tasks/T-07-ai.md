# T-07 — Computer opponent

Role: coder · Depends on: T-01, T-06 · Size: M

## Goal

Choose the AI's next shot purely from what it can see (its `enemyGrid`). Stateless: the grid holds
all knowledge, so there's nothing to keep in sync.

## Read first

- `src/shared/types.ts` (GridView, CellView, Coord, Rng, AiDifficulty)
- `src/shared/rules.ts`
- `src/shared/rng.ts`, `src/shared/board.ts` (exports only)
- `src/shared/shots.ts`, `src/shared/view.ts`, `src/shared/placement.ts` (exports only — used in the simulation test)

## Files

- create `src/shared/ai.ts`
- create `src/shared/ai.test.ts`

## Spec

```ts
import type { AiDifficulty, Coord, GridView, Rng } from "./types.ts";

export interface Ai {
  /** A cell whose state is "unknown" in grid. Throws Error if there is none. */
  nextShot(grid: GridView): Coord;
}
export function createAi(difficulty: AiDifficulty, rng: Rng): Ai;
```

Cell lists are always built by scanning `y` 0..9 outer, `x` 0..9 inner, then `pick(rng, list)`.

**easy**: pick among all `"unknown"` cells.

**normal** — first rule that yields a non-empty candidate list wins:

1. `blocked` = set of cells in `neighbors8` of any `"sunk"` cell — only when `ALLOW_ADJACENT_SHIPS`
   is false (else empty). Cells in `blocked` are never candidates in rules 2–4.
2. **Line target**: find any two `"hit"` cells that are orthogonal neighbours. Take the maximal run
   of consecutive `"hit"` cells along that axis through them. Candidates = the one cell just before
   the run and the one just after it, kept only if `"unknown"`, in bounds and not blocked.
3. **Single target**: candidates = every `"unknown"`, not blocked, `neighbors4` of every `"hit"` cell
   (deduplicate).
4. **Hunt**: `"unknown"`, not blocked, with `(x + y) % 2 === 0`; if empty, same without parity.
5. Fallback: any `"unknown"` cell.

## Tests (ai.test.ts) — build GridViews by hand with `filledGrid("unknown")` then set cells

1. easy on a grid with a single `"unknown"` cell returns it; on a grid with none throws.
2. normal with one `"hit"` at (5,5) returns one of (5,4),(4,5),(6,5),(5,6).
3. normal with hits (4,5),(5,5) returns (3,5) or (6,5); with (3,5) already `"miss"` returns (6,5).
4. Grid: every cell `"miss"` except `"sunk"` at (0,0),(1,0), `"unknown"` at (0,1),(1,1),(2,0),(2,1)
   (all blocked) and `"unknown"` at (9,9). normal returns (9,9) for seeds 1..50.
5. normal on an empty grid always returns a cell with `(x+y)%2===0` (100 seeds).
6. **Simulation**: for seeds 1..30, fleet = `randomFleet(createRng(seed))`, board = `createBoard(fleet)`;
   loop `c = ai.nextShot(enemyGrid(board,false))`, `board = fireAt(board,c)` (assert ok) until
   `allShipsSunk`. Assert every game ends in ≤ 100 shots; assert average normal shots < average easy
   shots − 10 (typical: easy ~95, normal ~55).

## Acceptance

`npm run format && npm run check` green; ai tests run in < 3 s.

## Out of scope

Timing/delays (controller's job).

## Coder notes

## Questions for architect

## Review
