# T-03 — Firing at a board

Role: coder · Depends on: T-02 · Size: S

## Goal

Create a `Board` from a fleet and apply shots to it, detecting hit / sunk / fleet destroyed.

## Read first

- `src/shared/types.ts` (Board, ShotResult, ShotError, Result)
- `src/shared/rules.ts`
- `src/shared/board.ts` (use its helpers; do not duplicate them)
- `src/shared/test-fixtures.ts`

## Files

- create `src/shared/shots.ts`
- create `src/shared/shots.test.ts`

## Spec

```ts
import type {
  Board,
  Coord,
  Fleet,
  Result,
  ShipPlacement,
  ShipType,
  ShotError,
  ShotResult,
} from "./types.ts";

/** { fleet, shotsReceived: [] }. Does NOT validate the fleet (callers do). */
export function createBoard(fleet: Fleet): Board;
export function hasBeenShot(board: Board, c: Coord): boolean;
/** true iff every cell of ship is in board.shotsReceived. */
export function isShipSunk(board: Board, ship: ShipPlacement): boolean;
/**
 * Errors: !inBounds(c) → "OUT_OF_BOUNDS"; already shot → "ALREADY_SHOT".
 * Otherwise returns a NEW board with c appended to shotsReceived, and a result:
 *   no ship at c                         → { coord: c, outcome: "miss" }
 *   ship at c, ship not sunk after shot  → { coord: c, outcome: "hit" }
 *   ship at c, ship sunk after this shot → { coord: c, outcome: "sunk", sunkShip: ship }
 * The input board must be unchanged.
 */
export function fireAt(
  board: Board,
  c: Coord,
): Result<{ board: Board; result: ShotResult }, ShotError>;
/** true iff every ship in the fleet is sunk. */
export function allShipsSunk(board: Board): boolean;
/** Types of ships NOT yet sunk, in SHIP_TYPES order. */
export function remainingShips(board: Board): ShipType[];
```

Copy `c` into the board as a fresh `{ x, y }` object (don't store caller-owned objects).

## Tests (shots.test.ts) — use FLEET_A

1. Shot at (9,9) → miss; returned board has 1 shot; original board still has 0.
2. Shot at (0,8) → hit (destroyer); then (1,8) → sunk with `sunkShip.type === "destroyer"`.
3. Same cell twice → second returns `{ ok:false, error:"ALREADY_SHOT" }`.
4. (10,0) and (-1,3) → OUT_OF_BOUNDS.
5. `remainingShips` after sinking the destroyer = the 4 other types in SHIP_TYPES order.
6. Firing every cell of every ship in FLEET_A → `allShipsSunk` true, and false one shot before.

## Acceptance

`npm run format && npm run check` green.

## Out of scope

Turns, players, views.

## Coder notes

## Questions for architect

## Review
