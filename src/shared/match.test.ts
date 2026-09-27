import { describe, it, expect } from "vitest";
import type { Coord } from "./types.ts";
import { createMatch, applyAction, other } from "./match.ts";
import { createBoard, allShipsSunk } from "./shots.ts";
import { FLEET_A, FLEET_B } from "./test-fixtures.ts";
import type { MatchState, PlayerId, MatchAction } from "./types.ts";

describe("match", () => {
  describe("other", () => {
    it("p1 → p2, p2 → p1", () => {
      expect(other("p1")).toBe("p2");
      expect(other("p2")).toBe("p1");
    });
  });

  describe("createMatch", () => {
    it("phase=placing, both boards null, turn=firstTurn, winner null, history []", () => {
      const state = createMatch("p2");
      expect(state).toEqual({
        phase: "placing",
        boards: { p1: null, p2: null },
        turn: "p2",
        winner: null,
        history: [],
      });
    });
  });

  describe("place action", () => {
    it("place p1 → still placing", () => {
      const state = createMatch("p1");
      const result = applyAction(state, {
        type: "place",
        player: "p1",
        fleet: FLEET_A,
      });
      expect(result.ok).toBe(true);
      const newState = (result as { ok: true; value: MatchState }).value;
      expect(newState.phase).toBe("placing");
    });

    it("place p2 → playing", () => {
      const state = createMatch("p1");
      const r1 = applyAction(state, {
        type: "place",
        player: "p1",
        fleet: FLEET_A,
      });
      const state2 = (r1 as { ok: true; value: MatchState }).value;
      const r2 = applyAction(state2, {
        type: "place",
        player: "p2",
        fleet: FLEET_B,
      });
      expect((r2 as { ok: true; value: MatchState }).value.phase).toBe("playing");
      expect((r2 as { ok: true; value: MatchState }).value.turn).toBe("p1");
    });

    it("place twice → ALREADY_PLACED", () => {
      const state = createMatch("p1");
      const r1 = applyAction(state, {
        type: "place",
        player: "p1",
        fleet: FLEET_A,
      });
      const state2 = (r1 as { ok: true; value: MatchState }).value;
      expect(
        applyAction(state2, {
          type: "place",
          player: "p1",
          fleet: FLEET_A,
        }),
      ).toEqual({ ok: false, error: "ALREADY_PLACED" });
    });

    it("invalid fleet (4 ships) → INVALID_FLEET", () => {
      const invalidFleet: any = FLEET_A.slice(0, 4);
      expect(
        applyAction(createMatch("p1"), {
          type: "place",
          player: "p1",
          fleet: invalidFleet,
        }),
      ).toEqual({ ok: false, error: "INVALID_FLEET" });
    });

    it("place during playing → NOT_PLACING", () => {
      const state = createMatch("p1");
      const r1 = applyAction(state, {
        type: "place",
        player: "p1",
        fleet: FLEET_A,
      });
      const r2 = applyAction((r1 as { ok: true; value: MatchState }).value, {
        type: "place",
        player: "p2",
        fleet: FLEET_B,
      });
      const playingState = (r2 as { ok: true; value: MatchState }).value;
      expect(
        applyAction(playingState, {
          type: "place",
          player: "p1",
          fleet: FLEET_A,
        }),
      ).toEqual({ ok: false, error: "NOT_PLACING" });
    });
  });

  describe("fire action", () => {
    it("fire during placing → NOT_PLAYING", () => {
      expect(
        applyAction(createMatch("p1"), {
          type: "fire",
          player: "p1",
          coord: { x: 0, y: 0 },
        }),
      ).toEqual({ ok: false, error: "NOT_PLAYING" });
    });

    it("wrong player → NOT_YOUR_TURN", () => {
      const state = createMatch("p1");
      const r1 = applyAction(state, {
        type: "place",
        player: "p1",
        fleet: FLEET_A,
      });
      const r2 = applyAction((r1 as { ok: true; value: MatchState }).value, {
        type: "place",
        player: "p2",
        fleet: FLEET_B,
      });
      const playingState = (r2 as { ok: true; value: MatchState }).value;
      expect(
        applyAction(playingState, {
          type: "fire",
          player: "p2",
          coord: { x: 0, y: 0 },
        }),
      ).toEqual({ ok: false, error: "NOT_YOUR_TURN" });
    });

    it("repeated cell → ALREADY_SHOT", () => {
      const state = createMatch("p1");
      const r1 = applyAction(state, {
        type: "place",
        player: "p1",
        fleet: FLEET_A,
      });
      const r2 = applyAction((r1 as { ok: true; value: MatchState }).value, {
        type: "place",
        player: "p2",
        fleet: FLEET_B,
      });
      let match = (r2 as { ok: true; value: MatchState }).value;

      // p1 hits carrier cell (0,0) — turns go p1, then p2
      const r3 = applyAction(match, {
        type: "fire",
        player: "p1",
        coord: { x: 0, y: 0 },
      });
      expect(r3.ok).toBe(true);
      match = (r3 as { ok: true; value: MatchState }).value;

      // p2 fires a miss, then turn is back to p1 to fire same cell
      const r4 = applyAction(match, {
        type: "fire",
        player: "p2",
        coord: { x: 1, y: 1 }, // FLEET_A has nothing there
      });
      expect(r4.ok).toBe(true);
      match = (r4 as { ok: true; value: MatchState }).value;

      // Now p1 fires ALREADY_SHOT
      expect(
        applyAction(match, {
          type: "fire",
          player: "p1",
          coord: { x: 0, y: 0 },
        }),
      ).toEqual({ ok: false, error: "ALREADY_SHOT" });
    });
  });

  describe("turns", () => {
    it("miss passes the turn", () => {
      const state = createMatch("p1");
      const r1 = applyAction(state, {
        type: "place",
        player: "p1",
        fleet: FLEET_A,
      });
      const r2 = applyAction((r1 as { ok: true; value: MatchState }).value, {
        type: "place",
        player: "p2",
        fleet: FLEET_B,
      });
      const playingState = (r2 as { ok: true; value: MatchState }).value;
      // FLEET_B is vertical at columns 0/2/4/6/8 → (5,5) is a miss
      const missResult = applyAction(playingState, {
        type: "fire",
        player: "p1",
        coord: { x: 5, y: 5 },
      });
      const afterMiss = (missResult as { ok: true; value: MatchState }).value;
      expect(afterMiss.turn).toBe("p2");
      expect(afterMiss.history).toHaveLength(1);
    });
  });

  describe("immutability", () => {
    it("JSON.stringify before and after applyAction is identical for same state", () => {
      const state = createMatch("p1");
      const before = JSON.stringify(state);
      const result = applyAction(state, {
        type: "place",
        player: "p1",
        fleet: FLEET_A,
      });
      const after = JSON.stringify(state); // original state unchanged
      expect(before).toBe(after);
    });
  });

  describe("full game", () => {
    it("p2 hits every FLEET_A cell (p1's board) → p2 wins", () => {
      // Set up match
      const state = createMatch("p1");
      const r1 = applyAction(state, {
        type: "place",
        player: "p1",
        fleet: FLEET_A,
      });
      const r2 = applyAction((r1 as { ok: true; value: MatchState }).value, {
        type: "place",
        player: "p2",
        fleet: FLEET_B,
      });
      let ms: MatchState = (r2 as { ok: true; value: MatchState }).value;
      expect(ms.phase).toBe("playing");

      // FLEET_A cells (p1's board, sorted top→bottom, left→right)
      // carrier(0,0)H: (0,0)..(4,0), battleship(0,2)H: (0,2)..(3,2),
      // cruiser(0,4)H: (0,4)..(2,4), submarine(0,6)H: (0,6)..(2,6),
      // destroyer(0,8)H: (0,8)..(1,8) — total 17 cells
      const fleetAAcells: Coord[] = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 4, y: 0 },
        { x: 0, y: 2 },
        { x: 1, y: 2 },
        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 0, y: 4 },
        { x: 1, y: 4 },
        { x: 2, y: 4 },
        { x: 0, y: 6 },
        { x: 1, y: 6 },
        { x: 2, y: 6 },
        { x: 0, y: 8 },
        { x: 1, y: 8 },
      ];
      // 25 unique safe coords for p1 misses (p1 needs exactly ai count misses)
      const safeCoords: Coord[] = [
        { x: 3, y: 0 },
        { x: 3, y: 1 },
        { x: 3, y: 2 },
        { x: 3, y: 3 },
        { x: 3, y: 4 },
        { x: 3, y: 5 },
        { x: 3, y: 6 },
        { x: 5, y: 0 },
        { x: 5, y: 1 },
        { x: 5, y: 2 },
        { x: 5, y: 3 },
        { x: 5, y: 4 },
        { x: 7, y: 0 },
        { x: 7, y: 1 },
        { x: 7, y: 2 },
        { x: 7, y: 3 },
        { x: 7, y: 4 },
        { x: 9, y: 0 },
        { x: 9, y: 1 },
        { x: 9, y: 2 },
        { x: 9, y: 3 },
        { x: 9, y: 4 },
        { x: 3, y: 7 },
        { x: 5, y: 7 },
        { x: 7, y: 7 },
      ];
      let si = 0;
      let ai = 0;

      // Each round: p1 misses (unique safe coord), p2 hits the next FLEET_A cell
      // After hitting all 17 FLEET_A cells, phase=finished, winner=p2
      while (ai < fleetAAcells.length) {
        const p1Res = applyAction(ms, {
          type: "fire",
          player: "p1",
          coord: safeCoords[si]!,
        });
        expect(p1Res.ok).toBe(true);
        ms = (p1Res as { ok: true; value: MatchState }).value;
        si++;

        const p2Res = applyAction(ms, {
          type: "fire",
          player: "p2",
          coord: fleetAAcells[ai]!,
        });
        expect(p2Res.ok).toBe(true);
        ms = (p2Res as { ok: true; value: MatchState }).value;
        ai++;
      }

      expect(ms.phase).toBe("finished");
      expect(ms.winner).toBe("p2");

      expect(
        applyAction(ms, {
          type: "fire",
          player: "p2",
          coord: { x: 0, y: 0 },
        }),
      ).toEqual({ ok: false, error: "NOT_PLAYING" });
    });
  });
});
