import { describe, it, expect } from "vitest";
import { createRng, randInt, pick, shuffle } from "./rng.ts";

describe("rng", () => {
  describe("createRng", () => {
    it("two createRng(123) produce identical first 10 values", () => {
      const r1 = createRng(123);
      const r2 = createRng(123);
      const a = Array.from({ length: 10 }, () => r1.next());
      const b = Array.from({ length: 10 }, () => r2.next());
      expect(a).toEqual(b);
    });

    it("createRng(1) and createRng(2) differ in the first value", () => {
      expect(createRng(1).next()).not.toBe(createRng(2).next());
    });

    it("seed is coerced with >>> 0 (negative seeds work)", () => {
      const r1 = createRng(-1);
      expect(r1.next()).toBeGreaterThan(0);
      expect(r1.next()).toBeLessThan(1);
    });
  });

  describe("rng.next()", () => {
    it("1000 values all in [0, 1)", () => {
      const rng = createRng(42);
      for (let k = 0; k < 1000; k++) {
        const v = rng.next();
        expect(v >= 0).toBe(true);
        expect(v < 1).toBe(true);
      }
    });
  });

  describe("randInt", () => {
    it("randInt(rng, 6) over 1000 draws: every value is integer 0..5 and all appear", () => {
      const rng = createRng(7);
      const seen = new Set<number>();
      for (let k = 0; k < 1000; k++) {
        const v = randInt(rng, 6);
        expect(Number.isInteger(v)).toBe(true);
        expect(v >= 0 && v <= 5).toBe(true);
        seen.add(v);
      }
      expect([...seen].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it("randInt(rng, 0) throws RangeError", () => {
      expect(() => randInt(createRng(0), 0)).toThrow(RangeError);
    });

    it("randInt(rng, -1) throws RangeError", () => {
      expect(() => randInt(createRng(0), -1)).toThrow(RangeError);
    });

    it("randInt(rng, 2.5) throws RangeError", () => {
      expect(() => randInt(createRng(0), 2.5)).toThrow(RangeError);
    });

    it("randInt(rng, 1) always returns 0", () => {
      const rng = createRng(99);
      for (let k = 0; k < 100; k++) {
        expect(randInt(rng, 1)).toBe(0);
      }
    });
  });

  describe("pick", () => {
    it("pick(rng, []) throws RangeError", () => {
      expect(() => pick(createRng(0), [])).toThrow(RangeError);
    });

    it('pick(rng, ["a"]) returns "a"', () => {
      expect(pick(createRng(0), ["a"])).toBe("a");
    });

    it("pick distributes over multiple draws", () => {
      const items = ["x", "y", "z"];
      const seen = new Set<string>();
      const rng = createRng(999);
      for (let k = 0; k < 300; k++) {
        seen.add(pick(rng, items));
      }
      expect([...seen].sort()).toEqual(items);
    });
  });

  describe("shuffle", () => {
    it("returns a permutation (same elements when sorted)", () => {
      const input = [3, 1, 4, 1, 5, 9];
      const rng = createRng(77);
      const out = shuffle(rng, input);
      expect([...out].sort((a, b) => a - b)).toEqual([...input].sort((a, b) => a - b));
    });

    it("does not mutate the input", () => {
      const input = ["a", "b", "c"];
      const copy = [...input];
      shuffle(createRng(1), input);
      expect(input).toEqual(copy);
    });

    it("same seed returns the same order", () => {
      const input = [1, 2, 3, 4, 5];
      expect(shuffle(createRng(42), input)).toEqual(shuffle(createRng(42), input));
    });

    it("shuffle of empty array returns empty array", () => {
      expect(shuffle(createRng(1), [])).toEqual([]);
    });

    it("shuffle of single element returns that element", () => {
      expect(shuffle(createRng(1), [42])).toEqual([42]);
    });
  });

  describe("exported names", () => {
    it("all expected exports exist", () => {
      expect(createRng).toBeTypeOf("function");
      expect(randInt).toBeTypeOf("function");
      expect(pick).toBeTypeOf("function");
      expect(shuffle).toBeTypeOf("function");
    });
  });
});
