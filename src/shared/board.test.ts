import { describe, it, expect } from "vitest";
import {
  coordKey,
  sameCoord,
  inBounds,
  shipCells,
  neighbors8,
  neighbors4,
  shipAt,
  validateShip,
  validateFleet,
} from "./board.ts";
import { SHIP_TYPES } from "./rules.ts";
import { FLEET_A, FLEET_B } from "./test-fixtures.ts";
import type { Fleet, Coord, ShipPlacement } from "./types.ts";

// Helper to build a valid full fleet
function makeFleet(overrides: Partial<ShipPlacement>[]): Fleet {
  const base: ShipPlacement[] = [
    { type: "carrier", x: 0, y: 0, orientation: "H" },
    { type: "battleship", x: 0, y: 2, orientation: "H" },
    { type: "cruiser", x: 0, y: 4, orientation: "H" },
    { type: "submarine", x: 0, y: 6, orientation: "H" },
    { type: "destroyer", x: 0, y: 8, orientation: "H" },
  ];
  const withOverrides = base.map((s) => ({
    ...s,
    ...(overrides.find((o: any) => o.type === s.type) || {}),
  }));
  return withOverrides as Fleet;
}

describe("board", () => {
  describe("coordKey", () => {
    it("produces expected format", () => {
      expect(coordKey({ x: 3, y: 4 })).toBe("3,4");
    });

    it("different coords differ", () => {
      expect(coordKey({ x: 3, y: 4 })).not.toBe(coordKey({ x: 4, y: 3 }));
    });
  });

  describe("sameCoord", () => {
    it("same coords are equal", () => {
      expect(sameCoord({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(true);
    });

    it("different coords are not equal", () => {
      expect(sameCoord({ x: 0, y: 0 }, { x: 0, y: 1 })).toBe(false);
    });
  });

  describe("inBounds", () => {
    it("(0,0) and (9,9) true; negatives and out-of-range false", () => {
      expect(inBounds({ x: 0, y: 0 })).toBe(true);
      expect(inBounds({ x: 9, y: 9 })).toBe(true);
      expect(inBounds({ x: -1, y: 0 })).toBe(false);
      expect(inBounds({ x: 10, y: 0 })).toBe(false);
      expect(inBounds({ x: 0, y: 10 })).toBe(false);
      expect(inBounds({ x: 1.5, y: 0 })).toBe(false);
    });
  });

  describe("shipCells", () => {
    it("cruiser H at (2,3) → [{2,3},{3,3},{4,3}]", () => {
      const cells = shipCells({
        type: "cruiser",
        x: 2,
        y: 3,
        orientation: "H",
      });
      expect(cells).toEqual([
        { x: 2, y: 3 },
        { x: 3, y: 3 },
        { x: 4, y: 3 },
      ]);
    });

    it("carrier V at (0,0) goes down", () => {
      expect(shipCells({ type: "carrier", x: 0, y: 0, orientation: "V" })).toEqual([
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
        { x: 0, y: 3 },
        { x: 0, y: 4 },
      ]);
    });

    it("returns count matching FLEET_SPEC", () => {
      for (const type of SHIP_TYPES) {
        const ship: ShipPlacement = { type, x: 0, y: 0, orientation: "H" };
        // FLEET_SPEC values: carrier=5, battleship=4, cruiser=3, submarine=3, destroyer=2
        const lengths: Record<string, number> = {
          carrier: 5,
          battleship: 4,
          cruiser: 3,
          submarine: 3,
          destroyer: 2,
        };
        expect(shipCells(ship).length).toBe(lengths[type]);
      }
    });
  });

  describe("neighbors8", () => {
    it("corner (0,0) has 3 cells", () => {
      expect(neighbors8({ x: 0, y: 0 })).toHaveLength(3);
      const nbs = neighbors8({ x: 0, y: 0 });
      expect(nbs).toContainEqual({ x: 1, y: 0 });
      expect(nbs).toContainEqual({ x: 0, y: 1 });
      expect(nbs).toContainEqual({ x: 1, y: 1 });
    });

    it("(5,5) has 8 cells", () => {
      expect(neighbors8({ x: 5, y: 5 })).toHaveLength(8);
    });

    it("does not include the cell itself", () => {
      expect(neighbors8({ x: 5, y: 5 }).some((n) => n.x === 5 && n.y === 5)).toBe(false);
    });
  });

  describe("neighbors4", () => {
    it("corner (0,0) has 2 cells", () => {
      expect(neighbors4({ x: 0, y: 0 })).toEqual([
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ]);
    });

    it("center (5,5) has 4 cells", () => {
      expect(neighbors4({ x: 5, y: 5 })).toEqual([
        { x: 4, y: 5 },
        { x: 6, y: 5 },
        { x: 5, y: 4 },
        { x: 5, y: 6 },
      ]);
    });
  });

  describe("validateFleet basics", () => {
    it("FLEET_A is ok", () => {
      expect(validateFleet(FLEET_A).ok).toBe(true);
    });

    it("FLEET_B is ok", () => {
      expect(validateFleet(FLEET_B).ok).toBe(true);
    });

    it("returns same reference on success", () => {
      const fleet = makeFleet([]);
      const result = validateFleet(fleet);
      expect(result).toEqual({ ok: true, value: fleet });
    });
  });

  describe("WRONG_FLEET", () => {
    it("only 4 ships", () => {
      const fleet = makeFleet([{ type: "destroyer" }]); // removes the last entry
      // Actually let's just construct an array with 4 entries (as unknown)
      const fleet4 = [
        { type: "carrier", x: 0, y: 0, orientation: "H" },
        { type: "battleship", x: 0, y: 2, orientation: "H" },
        { type: "cruiser", x: 0, y: 4, orientation: "H" },
        { type: "submarine", x: 0, y: 6, orientation: "H" },
      ] as unknown as Fleet;
      expect(validateFleet(fleet4)).toEqual({ ok: false, error: "WRONG_FLEET" });
    });

    it("two carriers + no destroyer", () => {
      const fleet = [
        { type: "carrier", x: 0, y: 0, orientation: "H" },
        { type: "battleship", x: 0, y: 2, orientation: "H" },
        { type: "cruiser", x: 0, y: 4, orientation: "H" },
        { type: "submarine", x: 0, y: 6, orientation: "H" },
        { type: "carrier", x: 5, y: 5, orientation: "H" },
      ] as unknown as Fleet;
      expect(validateFleet(fleet)).toEqual({ ok: false, error: "WRONG_FLEET" });
    });

    it("bad orientation 'X'", () => {
      const fleet = makeFleet([{ type: "battleship", orientation: "X" as any }]);
      expect(validateFleet(fleet)).toEqual({ ok: false, error: "WRONG_FLEET" });
    });
  });

  describe("OUT_OF_BOUNDS", () => {
    it("carrier at x:6 H needs 6..10 (out of bounds)", () => {
      const fleet = makeFleet([{ type: "carrier", x: 6, y: 0 }]);
      const result = validateFleet(fleet);
      expect(result).toEqual({ ok: false, error: "OUT_OF_BOUNDS" });
    });

    it("destroyer H at (8,8) goes to col 10 (out of bounds)", () => {
      const fleet = makeFleet([{ type: "destroyer", x: 8, y: 8, orientation: "H" }]);
      // destroyer length 2, so cells are (8,8), (9,8) — both in bounds!
      // But carrier at (8,8) H goes (8..12, 8) which is OUT_OF_BOUNDS
      const fleet2 = makeFleet([{ type: "carrier", x: 8, y: 8, orientation: "H" }]);
      const result = validateFleet(fleet2);
      expect(result).toEqual({ ok: false, error: "OUT_OF_BOUNDS" });
    });
  });

  describe("OVERLAP", () => {
    it("two ships sharing cells", () => {
      // carrier H at (0,0) occupies (0..4,0); battleship H at (0,1) occupies (0..3,1) — no overlap
      // Let's use crossing ships: carrier H (0,0) and battleship V (0,0) share (0,0)
      const fleet = makeFleet([{ type: "battleship", x: 0, y: 0, orientation: "V" }]);
      const result = validateFleet(fleet);
      expect(result).toEqual({ ok: false, error: "OVERLAP" });
    });
  });

  describe("ADJACENT", () => {
    it("ship directly below another", () => {
      // destroyer H at (0,1) is adjacent (below) carrier at (0,0) H
      const fleet = makeFleet([{ type: "destroyer", x: 0, y: 1, orientation: "H" }]);
      const result = validateFleet(fleet);
      expect(result).toEqual({ ok: false, error: "ADJACENT" });
    });

    it("diagonal adjacency also blocked", () => {
      const fleet = makeFleet([{ type: "destroyer", x: 1, y: 1, orientation: "H" }]);
      const result = validateFleet(fleet);
      expect(result).toEqual({ ok: false, error: "ADJACENT" });
    });
  });

  describe("precedence: OUT_OF_BOUNDS before OVERLAP", () => {
    it("fleet that is both reports OUT_OF_BOUNDS", () => {
      // carrier H at (8,8) is OUT_OF_BOUNDS and would overlap if in bounds
      const fleet = makeFleet([{ type: "carrier", x: 8, y: 8, orientation: "H" }]);
      const result = validateFleet(fleet);
      expect(result).toEqual({ ok: false, error: "OUT_OF_BOUNDS" });
    });
  });

  describe("validateShip same-type ignoring", () => {
    it("moving carrier onto its own spot is valid", () => {
      const carrier: ShipPlacement = { type: "carrier", x: 0, y: 0, orientation: "H" };
      const others: Fleet = [
        { type: "battleship", x: 0, y: 2, orientation: "H" },
        { type: "cruiser", x: 0, y: 4, orientation: "H" },
        { type: "submarine", x: 0, y: 6, orientation: "H" },
        { type: "destroyer", x: 0, y: 8, orientation: "H" },
      ];
      expect(validateShip(carrier, others)).toBeNull();
    });

    it("same-type ship not checked for overlap", () => {
      const carrier1: ShipPlacement = { type: "carrier", x: 0, y: 0, orientation: "H" };
      const carrier2: ShipPlacement = { type: "carrier", x: 0, y: 0, orientation: "H" };
      expect(validateShip(carrier1, [carrier2] as Fleet)).toBeNull();
    });
  });

  describe("shipAt", () => {
    it("finds the ship occupying a cell", () => {
      const carrier: ShipPlacement = { type: "carrier", x: 0, y: 0, orientation: "H" };
      const destroyer: ShipPlacement = { type: "destroyer", x: 2, y: 2, orientation: "V" };
      const fleet: Fleet = [carrier, destroyer] as Fleet;
      expect(shipAt(fleet, { x: 0, y: 0 })).toEqual(carrier);
      expect(shipAt(fleet, { x: 2, y: 3 })).toEqual(destroyer);
      expect(shipAt(fleet, { x: 5, y: 5 })).toBeUndefined();
    });
  });

  describe("coordKey as Map/Set key", () => {
    it("deduplicates", () => {
      const set = new Set<string>();
      set.add(coordKey({ x: 1, y: 2 }));
      set.add(coordKey({ x: 1, y: 2 }));
      set.add(coordKey({ x: 2, y: 1 }));
      expect(set.size).toBe(2);
    });
  });
});
