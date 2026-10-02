import { describe, it, expect } from "vitest";
import type { Coord } from "./types.ts";
import { formatCoord, ownGrid, enemyGrid, toPlayerView } from "./view.ts";
import { createMatch, applyAction } from "./match.ts";
import { FLEET_A, FLEET_B } from "./test-fixtures.ts";
import type { MatchState, PlayerView, PlayerId } from "./types.ts";

// ═══════════════════════════════════════════
// formatCoord
// ═══════════════════════════════════════════

describe("formatCoord", () => {
  it("origin → A1", () => {
    expect(formatCoord({ x: 0, y: 0 })).toBe("A1");
  });
  it("bottom-right → J10", () => {
    expect(formatCoord({ x: 9, y: 9 })).toBe("J10");
  });
  it("mid-cell → B7", () => {
    expect(formatCoord({ x: 1, y: 6 })).toBe("B7");
  });
});

// ═══════════════════════════════════════════
// fresh match: p1 view
// ═══════════════════════════════════════════

describe("fresh match", () => {
  it("p1 view: all-empty myGrid, all-unknown enemyGrid, both placed=false", () => {
    const state = createMatch("p1");
    const view = toPlayerView(state, "p1");
    expect(view.me).toBe("p1");
    expect(view.myPlaced).toBe(false);
    expect(view.enemyPlaced).toBe(false);
    expect(view.phase).toBe("placing");
    expect(view.winner).toBeNull();
    expect(view.isMyTurn).toBe(false);
    expect(view.lastShot).toBeNull();
    expect(view.enemyShipsRemaining).toEqual([
      "carrier",
      "battleship",
      "cruiser",
      "submarine",
      "destroyer",
    ]);
    expect(view.myShipsRemaining).toEqual([
      "carrier",
      "battleship",
      "cruiser",
      "submarine",
      "destroyer",
    ]);

    // myGrid: all "empty"
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        expect(view.myGrid[y]![x]).toBe("empty");
      }
    }

    // enemyGrid: all "unknown"
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        expect(view.enemyGrid[y]![x]).toBe("unknown");
      }
    }
  });
});

// ═══════════════════════════════════════════
// after both place: p1 myGrid, no ship leak
// ═══════════════════════════════════════════

describe("after placing", () => {
  it("p1 myGrid[0][0] === 'ship'; enemyGrid has no 'ship'", () => {
    const state = createMatch("p1");
    const r1 = applyAction(state, { type: "place", player: "p1", fleet: FLEET_A });
    const r2 = applyAction((r1 as { ok: true; value: MatchState }).value, {
      type: "place",
      player: "p2",
      fleet: FLEET_B,
    });
    const matchState = (r2 as { ok: true; value: MatchState }).value;

    // p1 view
    const p1View = toPlayerView(matchState, "p1");
    expect(p1View.myGrid[0]![0]).toBe("ship"); // carrier top-left
    expect(p1View.myPlaced).toBe(true);
    expect(p1View.enemyPlaced).toBe(true);

    // No "ship" in enemyGrid at all
    const hasShip = p1View.enemyGrid.flat().includes("ship");
    expect(hasShip).toBe(false);
  });
});

// ═══════════════════════════════════════════
// after p1 hits (0,0) of FLEET_B → "hit"
// ═══════════════════════════════════════════

describe("after hit", () => {
  it("p1 enemyGrid[0][0]='hit'; p2 myGrid[0][0]='hit'", () => {
    const state = createMatch("p1");
    const r1 = applyAction(state, { type: "place", player: "p1", fleet: FLEET_A });
    const placed = (r1 as { ok: true; value: MatchState }).value;
    const r2 = applyAction(placed, { type: "place", player: "p2", fleet: FLEET_B });
    const p2Place = (r2 as { ok: true; value: MatchState }).value;

    // p1 hits (0,0) → it's the carrier cell on p2's board (FLEET_B carrier)
    const fire = applyAction(p2Place, { type: "fire", player: "p1", coord: { x: 0, y: 0 } });
    const postFire = (fire as { ok: true; value: MatchState }).value;

    // p1 sees "hit" on enemyGrid
    const p1View = toPlayerView(postFire, "p1");
    expect(p1View.enemyGrid[0]![0]).toBe("hit");

    // p2 sees "hit" on their own myGrid (they received the shot)
    const p2View = toPlayerView(postFire, "p2");
    expect(p2View.myGrid[0]![0]).toBe("hit");
  });
});

// ═══════════════════════════════════════════
// after sinking destroyer → both "sunk"
// ═══════════════════════════════════════════

describe("after sunk destroyer", () => {
  it("both cells 'sunk'; enemyShipsRemaining lacks 'destroyer'", () => {
    // Build match: FLEET_A (p1 horizontal row 8), FLEET_B (p2 vertical col 8)
    const state = createMatch("p1");
    const r1 = applyAction(state, { type: "place", player: "p1", fleet: FLEET_A });
    const placed = (r1 as { ok: true; value: MatchState }).value;
    const r2 = applyAction(placed, { type: "place", player: "p2", fleet: FLEET_B });
    const withBoth = (r2 as { ok: true; value: MatchState }).value;

    // On FLEET_B: destroyer at (8,0)V → cells (8,0),(8,1)
    // p1 fires both → destroyed
    const shot1 = applyAction(withBoth, { type: "fire", player: "p1", coord: { x: 8, y: 0 } });
    const afterShot1 = (shot1 as { ok: true; value: MatchState }).value;
    const shot2 = applyAction(afterShot1, { type: "fire", player: "p2", coord: { x: 1, y: 1 } });
    const afterP2Miss = (shot2 as { ok: true; value: MatchState }).value;
    const shot3 = applyAction(afterP2Miss, { type: "fire", player: "p1", coord: { x: 8, y: 1 } });
    const postSink = (shot3 as { ok: true; value: MatchState }).value;

    const p1View = toPlayerView(postSink, "p1");
    // Destroyer at (8,0)V -> cells (8,0),(8,1). grid[y][x]
    expect(p1View.enemyGrid[0]![8]).toBe("sunk");
    expect(p1View.enemyGrid[1]![8]).toBe("sunk");
    expect(p1View.enemyShipsRemaining).not.toContain("destroyer");
  });
});

// ═══════════════════════════════════════════
// No-leak test: never leak "ship" in enemyGrid
// ═══════════════════════════════════════════

describe("no-ship-leak", () => {
  it('no "ship" in enemyGrid during play (16 alternating misses)', () => {
    const state = createMatch("p1");
    const r1 = applyAction(state, { type: "place", player: "p1", fleet: FLEET_A });
    const r2 = applyAction((r1 as { ok: true; value: MatchState }).value, {
      type: "place",
      player: "p2",
      fleet: FLEET_B,
    });
    let ms = (r2 as { ok: true; value: MatchState }).value;

    // p1-safe coords for p1 misses on p2's board (FLEET_B cols=0/2/4/6/8)
    // p2-safe coords for p2 misses on p1's board (FLEET_A cols=0/1/2/3/4)
    // All these columns are empty on FLEET_A / FLEET_B respectively
    const safe: Coord[] = [
      { x: 3, y: 0 },
      { x: 5, y: 0 },
      { x: 3, y: 1 },
      { x: 5, y: 1 },
      { x: 3, y: 2 },
      { x: 5, y: 2 },
      { x: 3, y: 3 },
      { x: 5, y: 3 },
      { x: 3, y: 4 },
      { x: 5, y: 4 },
      { x: 3, y: 5 },
      { x: 5, y: 5 },
      { x: 3, y: 6 },
      { x: 5, y: 6 },
      { x: 3, y: 7 },
      { x: 5, y: 7 },
    ];

    // 16 rounds: each round p1 then p2 fire at their unique safe coords
    for (let i = 0; i < 8; i++) {
      // Even index = p1 miss, odd index = p2 miss
      const p1Coord = safe[2 * i]!;
      const p1Fi = applyAction(ms, { type: "fire", player: "p1", coord: p1Coord });
      expect(p1Fi.ok).toBe(true);
      ms = (p1Fi as { ok: true; value: MatchState }).value;

      const p2Coord = safe[2 * i + 1]!;
      const p2Fi = applyAction(ms, { type: "fire", player: "p2", coord: p2Coord });
      expect(p2Fi.ok).toBe(true);
      ms = (p2Fi as { ok: true; value: MatchState }).value;

      for (const p of ["p1" as PlayerId, "p2" as PlayerId]) {
        const v = toPlayerView(ms, p);
        const hasShip = v.enemyGrid.flat().includes("ship");
        expect(hasShip, `${p} at round ${i}`).toBe(false);
      }
    }
  });
});

// ═══════════════════════════════════════════
// after finished: loser sees winner's untouched ships
// ═══════════════════════════════════════════

describe("after finished reveal", () => {
  it("loser's enemyGrid shows winner's untouched ships as 'ship'", () => {
    // p1 places FLEET_A (ships on left cols, rows 0/2/4/6/8)
    // p2 places FLEET_B (vertical ships)
    // p2 fires until winning (sinks FLEET_A)
    const state = createMatch("p1");
    const r1 = applyAction(state, { type: "place", player: "p1", fleet: FLEET_A });
    const placed = (r1 as { ok: true; value: MatchState }).value;
    const r2 = applyAction(placed, { type: "place", player: "p2", fleet: FLEET_B });
    let ms = (r2 as { ok: true; value: MatchState }).value;

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
      { x: 9, y: 0 },
      { x: 9, y: 1 },
      { x: 9, y: 2 },
      { x: 9, y: 3 },
    ];

    let si = 0,
      ai = 0;
    while (ai < fleetAAcells.length) {
      const p1Res = applyAction(ms, { type: "fire", player: "p1", coord: safeCoords[si++]! });
      const afterP1 = (p1Res as { ok: true; value: MatchState }).value;
      const p2Res = applyAction(afterP1, {
        type: "fire",
        player: "p2",
        coord: fleetAAcells[ai++]!,
      });
      ms = (p2Res as { ok: true; value: MatchState }).value;
    }

    expect(ms.phase).toBe("finished");

    // Loser (p1) sees p2's full board with ships revealed
    const p1View: PlayerView = toPlayerView(ms, "p1");
    // p2's carrier at (0,0)V should show as "ship" in p1's enemyGrid
    expect(p1View.enemyGrid[0]![0]).toBe("ship");
    expect(p1View.enemyGrid[0]![4]).toBe("ship"); // carrier end
    expect(p1View.winner).toBe("p2");
  });
});

// ═══════════════════════════════════════════
// view key count = exactly 11
// ═══════════════════════════════════════════

describe("view shape", () => {
  it("Object.keys(view).sort() === 11 PlayerView keys", () => {
    const state = createMatch("p1");
    const view = toPlayerView(state, "p1");
    const keys = Object.keys(view).sort();
    expect(keys).toEqual([
      "enemyGrid",
      "enemyPlaced",
      "enemyShipsRemaining",
      "isMyTurn",
      "lastShot",
      "me",
      "myGrid",
      "myPlaced",
      "myShipsRemaining",
      "phase",
      "winner",
    ]);
    expect(keys.length).toBe(11);
  });
});
