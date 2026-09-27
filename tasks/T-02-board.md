# T-02 — Board geometry and fleet validation

Role: coder · Depends on: — · Size: M

## Goal

Pure helpers for ship cells, bounds, and validating a single ship or a whole fleet against
`rules.ts`. Also shared test fixtures used by later tasks.

## Read first

- `src/shared/types.ts`
- `src/shared/rules.ts`

## Files

- create `src/shared/board.ts`
- create `src/shared/board.test.ts`
- create `src/shared/test-fixtures.ts`

## Spec — board.ts

```ts
import type { Coord, Fleet, PlacementError, Result, ShipPlacement } from "./types.ts";

/** "x,y" — use as Set/Map key. */
export function coordKey(c: Coord): string;
export function sameCoord(a: Coord, b: Coord): boolean;
/** true iff x and y are integers and 0 <= x,y < BOARD_SIZE. */
export function inBounds(c: Coord): boolean;
/** The FLEET_SPEC[ship.type] cells from (x,y): H → x, x+1, …; V → y, y+1, …  (may be out of bounds). */
export function shipCells(ship: ShipPlacement): Coord[];
/** The up-to-8 in-bounds cells around c (never c itself). */
export function neighbors8(c: Coord): Coord[];
/** The up-to-4 in-bounds cells left/right/up/down of c. */
export function neighbors4(c: Coord): Coord[];
/** First ship in fleet occupying c, or undefined. */
export function shipAt(fleet: Fleet, c: Coord): ShipPlacement | undefined;

/**
 * Can `ship` be added to `others`? Ships in `others` with the same `type` as `ship`
 * are IGNORED (the UI uses this when moving a ship). Checks in this order, returns the first failure:
 *   1. "OUT_OF_BOUNDS" — any cell of ship not inBounds
 *   2. "OVERLAP"       — any cell of ship equals a cell of another ship
 *   3. "ADJACENT"      — only if ALLOW_ADJACENT_SHIPS is false: any cell of ship is in
 *                         neighbors8 of a cell of another ship
 * Returns null when valid.
 */
export function validateShip(ship: ShipPlacement, others: Fleet): PlacementError | null;

/**
 * Whole-fleet validation. Returns the FIRST failure in this precedence:
 *   1. "WRONG_FLEET" — length !== SHIP_TYPES.length, or any type missing/duplicated,
 *                      or any orientation not "H"/"V"
 *   2. then for each ship in fleet order: validateShip(ship, all other ships) → its error
 * On success returns { ok: true, value: fleet } (the same array reference).
 */
export function validateFleet(fleet: Fleet): Result<Fleet, PlacementError>;
```

## Spec — test-fixtures.ts

Exactly these two valid fleets (used by tests in T-03, T-05, T-06, T-07, T-15):

```ts
import type { Fleet } from "./types.ts";

/** All horizontal, left edge, rows 0/2/4/6/8. */
export const FLEET_A: Fleet = [
  { type: "carrier", x: 0, y: 0, orientation: "H" },
  { type: "battleship", x: 0, y: 2, orientation: "H" },
  { type: "cruiser", x: 0, y: 4, orientation: "H" },
  { type: "submarine", x: 0, y: 6, orientation: "H" },
  { type: "destroyer", x: 0, y: 8, orientation: "H" },
];

/** All vertical, top edge, columns 0/2/4/6/8. */
export const FLEET_B: Fleet = [
  { type: "carrier", x: 0, y: 0, orientation: "V" },
  { type: "battleship", x: 2, y: 0, orientation: "V" },
  { type: "cruiser", x: 4, y: 0, orientation: "V" },
  { type: "submarine", x: 6, y: 0, orientation: "V" },
  { type: "destroyer", x: 8, y: 0, orientation: "V" },
];
```

## Tests (board.test.ts)

1. `shipCells({type:"cruiser",x:2,y:3,orientation:"H"})` → `[{x:2,y:3},{x:3,y:3},{x:4,y:3}]`; V variant goes down.
2. `inBounds`: (0,0) and (9,9) true; (-1,0), (10,0), (0,10), (1.5,0) false.
3. `neighbors8({x:0,y:0})` has 3 cells, `({x:5,y:5})` has 8; `neighbors4` corner → 2, middle → 4.
4. `validateFleet(FLEET_A)` and `(FLEET_B)` are ok.
5. WRONG_FLEET: 4 ships; two carriers + no destroyer; orientation `"X"` (cast via `as unknown as Fleet`).
6. OUT_OF_BOUNDS: carrier at x:6 H (needs x 6..10).
7. OVERLAP: two ships sharing a cell.
8. ADJACENT: ship touching another side-by-side, and another case touching only diagonally.
9. Precedence: a fleet that is both out-of-bounds and overlapping reports OUT_OF_BOUNDS for that ship.
10. `validateShip` ignores a same-type ship in `others` (moving the carrier onto its own old spot is valid).

## Acceptance

`npm run format && npm run check` green.

## Out of scope

Shots, sinking, random placement.

## Coder notes

Implemented `coordKey`, `sameCoord`, `inBounds`, `shipCells`, `neighbors8/4`, `shipAt`,
`validateShip`, `validateFleet` + fixtures FLEET_A/FLEET_B. Validation order:

1. WRONG_FLEET (length/types/orientation) 2) OUT_OF_BOUNDS 3) OVERLAP 4) ADJACENT
   (when ALLOW_ADJACENT_SHIPS false). `validateShip` ignores same-type ships. Test fixtures
   used by later tasks (T-03, T-05, T-06, T-07, T-15). All 29 tests pass.

## Questions for architect

## Review
