import { describe, it, expect } from "vitest";
import { createAi } from "./ai.ts";
import { createRng } from "./rng.ts";
import { enemyGrid } from "./view.ts";
import type { Coord, CellView, GridView, Rng } from "./types.ts";

function filled(fill: CellView): CellView[][] {
  const g: CellView[][] = [];
  for (let y = 0; y < 10; y++) {
    g[y] = new Array(10).fill(fill);
  }
  return g;
}
function findShipInFleet(fleet: Array<{ cells: Coord[] }>, coord: Coord) {
  const { x: sx, y: sy } = coord;
  return fleet.find((s) => s?.cells?.some((c) => c.x === sx && c.y === sy));
}
function shipCells2(ship: { cells: Coord[] }) {
  return ship?.cells?.filter((c) => c.state !== "sunk");
}

describe("ai", () => {
  describe("easy", () => {
    it("one unknown → returns it", () => {
      const grid = filled("miss");
      grid[3][5] = "unknown";
      const rng = createRng(42);
      const ai = createAi("easy", rng);
      const shot = ai.nextShot(grid);
      expect(shot).toEqual({ x: 5, y: 3 });
    });
    it("none unknown → throws", () => {
      const grid = filled("hit");
      const rng = createRng(42);
      const ai = createAi("easy", rng);
      expect(() => ai.nextShot(grid)).toThrow();
    });
  });
  describe("normal", () => {
    it("single hit at (5,5) → picks ortho-neighbour", () => {
      const grid = filled("unknown");
      grid[5][5] = "hit";
      const rng = createRng(42);
      const ai = createAi("normal", rng);
      const shot = ai.nextShot(grid);
      const valid =
        (shot.x === 5 && (shot.y === 4 || shot.y === 6)) ||
        (shot.y === 5 && (shot.x === 4 || shot.x === 6));
      expect(valid).toBe(true);
    });
    it("hits (4,5) && (5,5) → line target yields (3,5) or (6,5)", () => {
      const grid = filled("unknown");
      grid[4][5] = "hit";
      grid[5][5] = "hit";
      const rng = createRng(42);
      const ai = createAi("normal", rng);
      const shot = ai.nextShot(grid);
      expect(shot.y).toBe(5);
      expect([3, 6]).toContain(shot.x);
    });
    it("hit-pair with predecessor miss → only successor", () => {
      const grid = filled("unknown");
      grid[4][5] = "hit";
      grid[5][5] = "hit";
      grid[3][5] = "miss";
      const rng = createRng(42);
      const ai = createAi("normal", rng);
      const shot = ai.nextShot(grid);
      expect(shot.x).toBe(6);
      expect(shot.y).toBe(5);
    });
    it("sunk at (0,0),(1,0) → blocked cells excluded, (9,9) picked", () => {
      const grid = filled("miss");
      grid[0][0] = "sunk";
      grid[1][0] = "sunk";
      grid[0][1] = "unknown";
      grid[1][1] = "unknown";
      grid[2][0] = "unknown";
      grid[2][1] = "unknown";
      grid[9][9] = "unknown";
      const rng = createRng(42);
      const ai = createAi("normal", rng);
      const shot = ai.nextShot(grid);
      expect(shot.x).toBe(9);
      expect(shot.y).toBe(9);
    });
    it("hunt picks even parity on empty grid", () => {
      const rng = createRng(42);
      const ai = createAi("normal", rng);
      const grid = filled("unknown");
      const shot = ai.nextShot(grid);
      expect((shot.x + shot.y) % 2).toBe(0);
    });
  });
});
