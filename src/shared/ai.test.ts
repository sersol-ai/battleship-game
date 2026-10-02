import { describe, it, expect } from "vitest";
import { createAi } from "./ai.ts";
import { createRng } from "./rng.ts";
import type { CellView } from "./types.ts";

function filled(fill: CellView): CellView[][] {
  const g: CellView[][] = [];
  for (let y = 0; y < 10; y++) {
    g[y] = new Array(10).fill(fill);
  }
  return g;
}

describe("ai", () => {
  describe("easy", () => {
    it("one unknown -> returns it", () => {
      const grid = filled("miss");
      grid[3]![5] = "unknown";
      const rng = createRng(42);
      const ai = createAi("easy", rng);
      const shot = ai.nextShot(grid);
      expect(shot).toEqual({ x: 5, y: 3 });
    });
    it("none unknown -> throws", () => {
      const grid = filled("hit");
      const rng = createRng(42);
      const ai = createAi("easy", rng);
      expect(() => ai.nextShot(grid)).toThrow();
    });
  });
  describe("normal", () => {
    it("single hit at (5,5) -> finds ortho-neighbour", () => {
      const grid = filled("unknown");
      grid[5]![5] = "hit";
      const rng = createRng(0);
      const ai = createAi("normal", rng);
      const shot = ai.nextShot(grid);
      expect(
        ((shot.y === 4 || shot.y === 6) && shot.x === 5) ||
          ((shot.x === 4 || shot.x === 6) && shot.y === 5),
        "is an ortho-neighbour",
      ).toBe(true);
    });
  });
});
