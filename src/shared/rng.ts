import type { Rng } from "./types.ts";

/** Create a mulberry32 PRNG. Same seed → same sequence, forever. seed is coerced with `>>> 0`. */
export function createRng(seed: number): Rng {
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
}

/** Integer in [0, maxExclusive). Throws RangeError if maxExclusive is not a positive integer. */
export function randInt(rng: Rng, maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError(`randInt: maxExclusive must be a positive integer, got ${maxExclusive}`);
  }
  return Math.floor(rng.next() * maxExclusive);
}

/** Uniformly chosen element. Throws RangeError on an empty array. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) {
    throw new RangeError("pick: items array is empty");
  }
  return items[randInt(rng, items.length)]!;
}

/** New shuffled array (Fisher-Yates). Never mutates `items`. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const arr: T[] = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    const tmp = arr[j]!;
    arr[j] = arr[i]!;
    arr[i] = tmp;
  }
  return arr;
}
