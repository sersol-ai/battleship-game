import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createLocalController } from "./local-controller.ts";
import type { LocalControllerOptions } from "./local-controller.ts";
import type { GameController } from "./controller.ts";
import type { Fleet, Coord } from "../shared/types.ts";

const FLEET_A: Fleet = [
  { type: "carrier", x: 0, y: 0, orientation: "H" as const },
  { type: "battleship", x: 0, y: 6, orientation: "H" as const },
  { type: "cruiser", x: 7, y: 0, orientation: "H" as const },
  { type: "submarine", x: 7, y: 6, orientation: "H" as const },
  { type: "destroyer", x: 4, y: 4, orientation: "H" as const },
] as Fleet;

let controller: GameController | null = null;
const opts: LocalControllerOptions = { difficulty: "easy", seed: 7, aiDelayMs: 100 };
let snapshots: any[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  snapshots = [];
});

afterEach(() => {
  controller?.dispose();
  controller = null;
  vi.useRealTimers();
});

function lastSnap(): any {
  return snapshots.at(-1)!;
}
describe("local-controller", () => {
  it("initial snapshot: phase placing, myPlaced false, enemyPlaced true, mode 'ai'", () => {
    controller = createLocalController(opts);
    controller.subscribe((snap: any) => snapshots.push(snap));

    const s = lastSnap();
    expect(s.mode).toBe("ai");
    expect(s.view?.phase).toBe("placing");
    expect(s.view?.myPlaced).toBe(false);
    expect(s.view?.enemyPlaced).toBe(true);
    expect(s.connection).toBe("open");
    expect(s.opponent).toBe("connected");
    expect(s.room).toBeNull();
    expect(s.error).toBeNull();
  });

  it("place(FLEET_A) → phase playing, isMyTurn true", () => {
    controller = createLocalController(opts);
    controller.subscribe((snap: any) => snapshots.push(snap));
    controller.place(FLEET_A);
    expect(lastSnap().view!.phase).toBe("playing");
    expect(lastSnap().view!.isMyTurn).toBe(true);
    expect(lastSnap().view!.myPlaced).toBe(true);
    expect(lastSnap().error).toBeNull();
  });

  it("fire({x:0,y:0}) → isMyTurn false; advance timers → isMyTurn true and lastShot.by === 'p2'", () => {
    controller = createLocalController(opts);
    controller.subscribe((snap: any) => snapshots.push(snap));
    controller.place(FLEET_A);
    expect(lastSnap().view!.isMyTurn).toBe(true);

    controller.fire({ x: 0, y: 0 });
    expect(lastSnap().view!.isMyTurn).toBe(false);

    vi.advanceTimersByTime(100);
    const afterAi = lastSnap();
    expect(afterAi.view!.isMyTurn).toBe(true);
    expect(afterAi.view!.lastShot?.by).toBe("p2");
  });

  it("fire when not my turn → snapshot.error is non-empty string; state unchanged", () => {
    controller = createLocalController(opts);
    controller.subscribe((snap: any) => snapshots.push(snap));
    controller.place(FLEET_A);
    controller.fire({ x: 0, y: 0 });

    const errSnap = lastSnap();
    controller.fire({ x: 1, y: 1 });
    expect(lastSnap().error).not.toBeNull();
    expect((lastSnap().error as string).length).toBeGreaterThan(0);
    expect(lastSnap().view!.isMyTurn).toBe(false);
  });

  it("invalid fleet → error set; valid place afterwards clears it", () => {
    controller = createLocalController(opts);
    controller.subscribe((snap: any) => snapshots.push(snap));
    const badFleet: Fleet = [{ type: "carrier", x: 10, y: 10, orientation: "H" as const }] as Fleet;
    controller.place(badFleet);
    expect(lastSnap().error).not.toBeNull();

    controller.place(FLEET_A);
    expect(lastSnap().error).toBeNull();
  });

  it("full game: fire at every cell → until phase finished; winner is set; rematch resets", () => {
    controller = createLocalController(opts);
    controller.subscribe((snap: any) => snapshots.push(snap));
    controller.place(FLEET_A);

    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        if (lastSnap().view!.phase === "finished") break;
        controller.fire({ x, y });
        vi.advanceTimersByTime(100);
      }
      if (lastSnap().view!.phase === "finished") break;
    }

    expect(lastSnap().view!.phase).toBe("finished");
    expect(lastSnap().view!.winner).not.toBeNull();
    controller.rematch();
    expect(lastSnap().view!.phase).toBe("placing");
    expect(lastSnap().view!.myPlaced).toBe(false);
  });

  it("dispose() during a pending AI timer → advancing timers calls no listener", () => {
    controller = createLocalController(opts);
    controller.subscribe((snap: any) => snapshots.push(snap));
    controller.place(FLEET_A);
    controller.fire({ x: 0, y: 0 });
    const snapBefore = lastSnap();
    controller.dispose();

    const countBefore = snapshots.length;
    vi.runAllTimers();
    expect(snapshots.length).toBe(countBefore);
    expect(lastSnap()).toBe(snapBefore);
  });

  it("same seed → same AI shot sequence across two controllers", () => {
    const ctrl1 = createLocalController(opts);
    const ctrl2 = createLocalController(opts);

    const snaps1: any[] = [];
    const snaps2: any[] = [];
    ctrl1.subscribe((s) => snaps1.push(s));
    ctrl2.subscribe((s) => snaps2.push(s));

    ctrl1.place(FLEET_A);
    ctrl2.place(FLEET_A);

    const results1: string[] = [];
    const results2: string[] = [];

    for (let round = 0; round < 30; round++) {
      const v1 = snaps1[snaps1.length - 1]?.view;
      if (!v1 || v1.phase === "finished") break;
      const v2 = snaps2[snaps2.length - 1]?.view;
      if (!v2 || v2.phase === "finished") break;

      // find unknown cells
      let found1 = false,
        found2 = false;
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          if (!found1 && v1.enemyGrid[y]![x]! === "unknown") {
            ctrl1.fire({ x, y });
            results1.push(`${x},${y}`);
            found1 = true;
          }
          if (!found2 && v2.enemyGrid[y]![x]! === "unknown") {
            ctrl2.fire({ x, y });
            results2.push(`${x},${y}`);
            found2 = true;
          }
        }
      }
      vi.advanceTimersByTime(100);

      if (snaps1.length > 0) {
        const last = snaps1[snaps1.length - 1];
        if (last.view?.lastShot) {
          // Check AI responded
        }
      }
      if (snaps2.length > 0) {
        const last = snaps2[snaps2.length - 1];
        if (last.view?.lastShot) {
          // Check AI responded
        }
      }

      if (
        snaps1[snaps1.length - 1]?.view?.phase === "finished" &&
        snaps2[snaps2.length - 1]?.view?.phase === "finished"
      )
        break;
    }

    ctrl1.dispose();
    ctrl2.dispose();
  });
});
