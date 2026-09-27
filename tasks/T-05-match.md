# T-05 — Match state machine

Role: coder · Depends on: T-03 · Size: M

## Goal

A pure reducer for a 2-player match. Used by the local (vs AI) controller AND the server.

## Read first

- `src/shared/types.ts` (MatchState, MatchAction, MatchError, Result, PlayerId)
- `src/shared/rules.ts` (EXTRA_SHOT_ON_HIT)
- `src/shared/board.ts`, `src/shared/shots.ts` (exports only)
- `src/shared/test-fixtures.ts`

## Files

- create `src/shared/match.ts`
- create `src/shared/match.test.ts`

## Spec

```ts
import type { MatchAction, MatchError, MatchState, PlayerId, Result } from "./types.ts";

export function other(p: PlayerId): PlayerId;
/** phase "placing", both boards null, turn = firstTurn, winner null, history []. */
export function createMatch(firstTurn: PlayerId): MatchState;
/** Never mutates `state`. */
export function applyAction(state: MatchState, action: MatchAction): Result<MatchState, MatchError>;
```

`place` action, check in order:

1. `phase !== "placing"` → `NOT_PLACING`
2. `boards[player] !== null` → `ALREADY_PLACED`
3. `validateFleet(fleet)` fails → `INVALID_FLEET`
4. OK: `boards[player] = createBoard(fleet)`. If both boards are now non-null → `phase = "playing"`
   (turn stays what createMatch set).

`fire` action, check in order:

1. `phase !== "playing"` → `NOT_PLAYING`
2. `player !== turn` → `NOT_YOUR_TURN`
3. `fireAt(boards[other(player)], coord)` error → that error (`OUT_OF_BOUNDS` / `ALREADY_SHOT`)
4. OK: replace opponent board, append `{ by: player, result }` to history, then:
   - if `allShipsSunk(opponent board)` → `phase = "finished"`, `winner = player`, turn unchanged
   - else if `result.outcome !== "miss" && EXTRA_SHOT_ON_HIT` → turn unchanged
   - else `turn = other(player)`

## Tests (match.test.ts) — p1 places FLEET_A, p2 places FLEET_B

1. `createMatch("p2")` shape is exactly as specified.
2. Place p1 → still placing; place p2 → playing, turn = firstTurn. Order p2-then-p1 works too.
3. Place twice → ALREADY_PLACED. Invalid fleet (4 ships) → INVALID_FLEET. Place during playing → NOT_PLACING.
4. Fire during placing → NOT_PLAYING. Wrong player → NOT_YOUR_TURN. Repeated cell → ALREADY_SHOT.
5. Miss passes the turn; hit passes the turn (EXTRA_SHOT_ON_HIT is false). History grows by 1 per shot.
6. Full game: script p1 firing at every FLEET_B ship cell while p2 fires at non-ship cells of
   FLEET_A (e.g. column 9, rows 0..9, then column 7...) → ends `finished`, `winner "p1"`;
   any action afterwards: fire → NOT_PLAYING.
7. Immutability: `JSON.stringify(state)` before and after `applyAction` on it is identical.

## Acceptance

`npm run format && npm run check` green.

## Out of scope

Views/redaction (T-06), AI, rematch (callers just call createMatch again).

## Coder notes

## Questions for architect

## Review
