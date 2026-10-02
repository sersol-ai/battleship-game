import { describe, it, expect } from "vitest";
import {
  createBoard,
  hasBeenShot,
  isShipSunk,
  fireAt,
  allShipsSunk,
  remainingShips,
} from "./shots.ts";
import { FLEET_A } from "./test-fixtures.ts";
import type { Board, Coord, ShipPlacement } from "./types.ts";

describe("shots", () => {
  describe("createBoard", () => {
    it("creates a board with fleet and empty shotsReceived", () => {
      const board = createBoard(FLEET_A);
      expect(board.fleet).toBe(FLEET_A);
      expect(board.shotsReceived).toEqual([]);
    });
  });

  describe("fireAt", () => {
    it("shot at (9,9) → miss; returned board has 1 shot; original unchanged", () => {
      const board = createBoard(FLEET_A);
      const c: Coord = { x: 9, y: 9 };
      const result = fireAt(board, c);
      expect(result).toEqual({
        ok: true,
        value: {
          board: { fleet: FLEET_A, shotsReceived: [{ x: 9, y: 9 }] },
          result: { coord: { x: 9, y: 9 }, outcome: "miss" },
        },
      });
      expect(board.shotsReceived).toEqual([]);
    });

    it("shot at (0,8) → hit; then (1,8) → sunk destroyer", () => {
      const board = createBoard(FLEET_A);
      const c1: Coord = { x: 0, y: 8 };
      const res1 = fireAt(board, c1);
      expect(res1).toEqual({
        ok: true,
        value: {
          board: { fleet: FLEET_A, shotsReceived: [c1] },
          result: { coord: { x: 0, y: 8 }, outcome: "hit" },
        },
      });

      // Safe access — we verified res1.ok is true above
      const board2 = (res1 as { ok: true; value: { board: Board } }).value.board;
      const c2: Coord = { x: 1, y: 8 };
      const res2 = fireAt(board2, c2);
      expect(res2).toEqual({
        ok: true,
        value: {
          board: { fleet: FLEET_A, shotsReceived: [c1, c2] },
          result: {
            coord: { x: 1, y: 8 },
            outcome: "sunk",
            sunkShip: { type: "destroyer", x: 0, y: 8, orientation: "H" },
          },
        },
      });
    });

    it("same cell twice → ALREADY_SHOT", () => {
      const board = createBoard(FLEET_A);
      const c: Coord = { x: 5, y: 5 };
      const r1 = fireAt(board, c);
      expect(r1.ok).toBe(true);
      const board2 = (r1 as { ok: true; value: { board: Board } }).value.board;
      expect(fireAt(board2, c)).toEqual({ ok: false, error: "ALREADY_SHOT" });
    });

    it("(10,0) and (-1,3) → OUT_OF_BOUNDS", () => {
      const board = createBoard(FLEET_A);
      expect(fireAt(board, { x: 10, y: 0 })).toEqual({ ok: false, error: "OUT_OF_BOUNDS" });
      expect(fireAt(board, { x: -1, y: 3 })).toEqual({ ok: false, error: "OUT_OF_BOUNDS" });
    });
  });

  describe("isShipSunk", () => {
    it("not sunk until all cells shot", () => {
      const board = createBoard(FLEET_A);
      const destroyer: ShipPlacement = FLEET_A[4]!;
      expect(isShipSunk(board, destroyer)).toBe(false);
    });

    it("sunk when all cells shot", () => {
      const shots: Coord[] = [
        { x: 0, y: 8 },
        { x: 1, y: 8 },
      ];
      const board: Board = { fleet: FLEET_A, shotsReceived: shots };
      const destroyer: ShipPlacement = {
        type: "destroyer",
        x: 0,
        y: 8,
        orientation: "H",
      };
      expect(isShipSunk(board, destroyer)).toBe(true);
    });
  });

  describe("remainingShips", () => {
    it("after sinking destroyer → 4 types in SHIP_TYPES order", () => {
      const shots: Coord[] = [
        { x: 0, y: 8 },
        { x: 1, y: 8 },
      ];
      const board: Board = { fleet: FLEET_A, shotsReceived: shots };
      expect(remainingShips(board)).toEqual(["carrier", "battleship", "cruiser", "submarine"]);
    });

    it("empty shots → all 5 ships remaining", () => {
      const board = createBoard(FLEET_A);
      expect(remainingShips(board)).toEqual([
        "carrier",
        "battleship",
        "cruiser",
        "submarine",
        "destroyer",
      ]);
    });
  });

  describe("allShipsSunk", () => {
    it("false with no shots", () => {
      const board = createBoard(FLEET_A);
      expect(allShipsSunk(board)).toBe(false);
    });

    it("true when every ship cell is shot", () => {
      const len: Record<string, number> = {
        carrier: 5,
        battleship: 4,
        cruiser: 3,
        submarine: 3,
        destroyer: 2,
      };
      const shots: Coord[] = [];
      for (const ship of FLEET_A) {
        for (let k = 0; k < len[ship.type]!; k++) {
          shots.push(
            ship.orientation === "H" ? { x: ship.x + k, y: ship.y } : { x: ship.x, y: ship.y + k },
          );
        }
      }
      const board: Board = { fleet: FLEET_A, shotsReceived: shots };
      expect(allShipsSunk(board)).toBe(true);
    });
  });
});
