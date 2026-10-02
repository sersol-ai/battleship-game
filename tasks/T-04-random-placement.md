# T-04 — Random valid fleet

Role: coder · Depends on: T-01, T-02 · Size: S

## Goal

Generate a random fleet that always passes `validateFleet`. Used by the AI and the "Random" button.

## Read first

- `src/shared/types.ts` (Fleet, ShipPlacement, Rng)
- `src/shared/rules.ts`
- `src/shared/rng.ts`, `src/shared/board.ts` (exports only — skim)

## Files

- create `src/shared/placement.ts`
- create `src/shared/placement.test.ts`

## Spec

```ts
import type { Fleet, Rng } from "./types.ts";

export function randomFleet(rng: Rng): Fleet;
```

Algorithm (implement exactly this — it is deterministic for a given seed):

```
attempt loop (max 100 attempts, then throw Error("randomFleet: no valid layout")):
  placed = []
  for type of SHIP_TYPES (in order):
    candidates = []
    for orientation of ["H", "V"]:
      for y from 0 to BOARD_SIZE-1:
        for x from 0 to BOARD_SIZE-1:
          ship = { type, x, y, orientation }
          if validateShip(ship, placed) === null: candidates.push(ship)
    if candidates is empty: continue attempt loop (start over)
    placed.push(pick(rng, candidates))
  return placed
```

## Tests (placement.test.ts)

1. For seeds 1..300, `validateFleet(randomFleet(createRng(seed))).ok === true`.
2. Same seed twice → deep-equal fleets.
3. Seeds 1..20 produce at least 15 distinct fleets (compare `JSON.stringify`).
4. Result contains one ship of each type in SHIP_TYPES order.

## Acceptance

`npm run format && npm run check` green; placement tests run in < 2 s.

## Out of scope

UI. Placement of a single ship.

## Coder notes

## Questions for architect

## Review
