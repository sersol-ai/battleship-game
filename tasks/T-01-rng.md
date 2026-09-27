# T-01 — Seeded RNG

Role: coder · Depends on: — · Size: S

## Goal

Deterministic random numbers for the whole engine. Nothing in `src/shared` may call `Math.random()`.

## Read first

- `src/shared/types.ts` (only the `Rng` interface)

## Files

- create `src/shared/rng.ts`
- create `src/shared/rng.test.ts`

## Spec

```ts
import type { Rng } from "./types.ts";

/** mulberry32 PRNG. Same seed → same sequence, forever. seed is coerced with `>>> 0`. */
export function createRng(seed: number): Rng;
/** Integer in [0, maxExclusive). Throws RangeError if maxExclusive is not a positive integer. */
export function randInt(rng: Rng, maxExclusive: number): number;
/** Uniformly chosen element. Throws RangeError on an empty array. */
export function pick<T>(rng: Rng, items: readonly T[]): T;
/** New shuffled array (Fisher–Yates). Never mutates `items`. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[];
```

Use exactly this mulberry32 body (so sequences match across tasks):

```ts
let a = seed >>> 0;
return {
  next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  },
};
```

`randInt` = `Math.floor(rng.next() * maxExclusive)`. `pick` uses `randInt`. `shuffle`: copy the
array, then for `i` from `length-1` down to `1`: `j = randInt(rng, i + 1)`, swap `i` and `j`.

## Tests (rng.test.ts)

1. Two `createRng(123)` produce identical first 10 values.
2. `createRng(1)` and `createRng(2)` differ in the first value.
3. 1000 values of `next()` are all `>= 0` and `< 1`.
4. `randInt(rng, 6)` over 1000 draws: every value is an integer 0..5 and each of 0..5 appears.
5. `randInt(rng, 0)`, `randInt(rng, -1)`, `randInt(rng, 2.5)` throw `RangeError`.
6. `pick(rng, [])` throws `RangeError`; `pick(rng, ["a"])` returns `"a"`.
7. `shuffle` returns a permutation (same elements when sorted), does not mutate the input
   (compare with a copy), and with the same seed returns the same order.

## Acceptance

`npm run format && npm run check` green.

## Out of scope

Any other file. Seeding from time/crypto (that lives in client/server code).

## Coder notes

## Questions for architect

## Review
