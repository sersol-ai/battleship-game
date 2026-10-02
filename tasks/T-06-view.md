# T-06 — Player views (redaction)

Role: coder · Depends on: T-05 · Size: M

## Goal

Turn a `MatchState` into what ONE player may see. This is the security boundary for online play:
the enemy's unsunk ships must never appear before the match is finished.

## Read first

- `src/shared/types.ts` (CellView, GridView, PlayerView)
- `src/shared/rules.ts`
- `src/shared/board.ts`, `src/shared/shots.ts`, `src/shared/match.ts` (exports only)
- `src/shared/test-fixtures.ts`

## Files

- create `src/shared/view.ts`
- create `src/shared/view.test.ts`

## Spec

```ts
import type {
  Board,
  CellView,
  Coord,
  GridView,
  MatchState,
  PlayerId,
  PlayerView,
} from "./types.ts";

/** New BOARD_SIZE×BOARD_SIZE grid, every cell = fill. grid[y][x]. */
export function filledGrid(fill: CellView): CellView[][];
/**
 * My own board. null → all "empty".
 * Else start all "empty"; every fleet cell → "ship"; then for every shot received:
 *   no ship there → "miss"; ship there and that ship sunk → "sunk"; else → "hit".
 */
export function ownGrid(board: Board | null): GridView;
/**
 * Opponent's board as I see it. null → all "unknown".
 * Else start all "unknown"; shots exactly as ownGrid ("miss"/"hit"/"sunk").
 * If reveal: every fleet cell still "unknown" becomes "ship".
 */
export function enemyGrid(board: Board | null, reveal: boolean): GridView;
/** {x:1,y:6} → "B7". Columns A–J, rows 1–10. */
export function formatCoord(c: Coord): string;
export function toPlayerView(state: MatchState, me: PlayerId): PlayerView;
```

`toPlayerView` fields:

| field                 | value                                                   |
| --------------------- | ------------------------------------------------------- |
| `me`                  | me                                                      |
| `phase`, `winner`     | copied                                                  |
| `isMyTurn`            | `phase === "playing" && turn === me`                    |
| `myPlaced`            | `boards[me] !== null`                                   |
| `enemyPlaced`         | `boards[other(me)] !== null`                            |
| `myGrid`              | `ownGrid(boards[me])`                                   |
| `enemyGrid`           | `enemyGrid(boards[other(me)], phase === "finished")`    |
| `myShipsRemaining`    | `remainingShips(board)` or all SHIP_TYPES if board null |
| `enemyShipsRemaining` | same for the enemy board                                |
| `lastShot`            | last element of `history`, or `null`                    |

The view must contain no other properties (it is serialized onto the network).

## Tests (view.test.ts) — p1 FLEET_A, p2 FLEET_B

1. `formatCoord({x:0,y:0})` "A1", `({x:9,y:9})` "J10", `({x:1,y:6})` "B7".
2. Fresh match: p1 view has all-"empty" myGrid, all-"unknown" enemyGrid, both placed false.
3. After both place: p1 `myGrid[0][0] === "ship"`; p1 enemyGrid has no `"ship"` anywhere.
4. After p1 hits (0,0) of FLEET_B: p1 enemyGrid[0][0] "hit"; p2 myGrid[0][0] "hit".
5. After p1 sinks the destroyer (8,0),(8,1): both cells "sunk" in p1's enemyGrid; enemyShipsRemaining lacks "destroyer".
6. **No-leak test**: play a scripted game until one shot before the end; at EVERY step,
   `JSON.stringify(toPlayerView(state, p))` never contains `"ship"` inside `enemyGrid` for either player
   (check `view.enemyGrid.flat().includes("ship") === false`).
7. After finished: loser's enemyGrid shows winner's untouched ships as "ship".
8. `Object.keys(view).sort()` equals exactly the 11 PlayerView keys.

## Acceptance

`npm run format && npm run check` green.

## Out of scope

Rendering. AI.

## Coder notes

## Questions for architect

## Review
