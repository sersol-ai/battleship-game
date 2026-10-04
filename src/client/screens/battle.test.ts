// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { mountBattle } from "./battle.ts";
import type { BattleDeps } from "./battle.ts";
import type { ControllerSnapshot, ConnectionState, GameController } from "../controller.ts";
import type { OpponentStatus, RoomCode } from "../../shared/protocol.ts";
import type {
  CellView,
  Coord,
  GridView,
  PlayerId,
  PlayerView,
  ShipType,
  ShotResult,
} from "../../shared/types.ts";
import { formatCoord } from "../../shared/view.ts";

function unknownGrid(): GridView {
  const rows: CellView[][] = [];
  for (let y = 0; y < 10; y += 1) {
    const row: CellView[] = [];
    for (let x = 0; x < 10; x += 1) {
      row.push("unknown");
    }
    rows.push(row);
  }
  return rows;
}

function withCell(x: number, y: number, value: CellView): GridView {
  const rows: CellView[][] = [];
  for (let row = 0; row < 10; row += 1) {
    const cells: CellView[] = [];
    for (let col = 0; col < 10; col += 1) {
      cells.push(row === y && col === x ? value : "unknown");
    }
    rows.push(cells);
  }
  return rows;
}

interface ViewOverrides {
  readonly phase?: "placing" | "playing" | "finished";
  readonly isMyTurn?: boolean;
  readonly winner?: PlayerId | null;
  readonly lastShot?: { readonly by: PlayerId; readonly result: ShotResult } | null;
}

function viewFor(overrides: ViewOverrides): PlayerView {
  return {
    me: "p1",
    phase: "playing",
    isMyTurn: true,
    winner: null,
    myPlaced: true,
    enemyPlaced: true,
    myGrid: unknownGrid(),
    enemyGrid: unknownGrid(),
    enemyShipsRemaining: ["carrier", "battleship"],
    myShipsRemaining: ["carrier", "battleship", "cruiser"],
    lastShot: null,
    ...overrides,
  };
}

interface Rig {
  readonly controller: GameController;
  readonly push: (snapshot: ControllerSnapshot) => void;
  readonly fired: Array<Coord>;
  readonly rematchCalls: Array<0>;
}

function makeRig(snapshot: ControllerSnapshot): Rig {
  let current = snapshot;
  const listeners: Array<(snapshot: ControllerSnapshot) => void> = [];
  const fired: Array<Coord> = [];
  const rematchCalls: Array<0> = [];
  const controller: GameController = {
    subscribe: (listener) => {
      listeners.push(listener);
      listener(current);
      return () => {
        listeners.length = 0;
      };
    },
    getSnapshot: () => current,
    place: () => {},
    fire: (coord) => {
      fired.push(coord);
    },
    rematch: () => {
      rematchCalls.push(0);
    },
    dispose: () => {},
  };
  return {
    controller,
    push: (next) => {
      current = next;
      for (const listener of listeners) {
        listener(next);
      }
    },
    fired,
    rematchCalls,
  };
}

function snapshotFor(view: PlayerView | null, mode: "ai" | "online"): ControllerSnapshot {
  return {
    view,
    mode,
    connection: mode === "ai" ? "open" : ("open" as ConnectionState),
    opponent: mode === "ai" ? "connected" : ("connected" as OpponentStatus),
    room: null as RoomCode | null,
    error: null,
  };
}

function newRoot(): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("data-testid", "battle-root");
  return root;
}

function queryButton(root: HTMLElement, selector: string): HTMLButtonElement {
  const found = root.querySelector(selector) as HTMLButtonElement | null;
  if (found === null) {
    throw new Error(`${selector} missing`);
  }
  return found;
}

function queryNode(root: HTMLElement, selector: string): HTMLElement {
  const found = root.querySelector(selector) as HTMLElement | null;
  if (found === null) {
    throw new Error(`${selector} missing`);
  }
  return found;
}

function enemyCell(root: HTMLElement, x: number, y: number): HTMLButtonElement {
  const found = root.querySelector(
    `[data-testid="grid-enemy"] [data-testid="cell"][data-x="${x}"][data-y="${y}"]`,
  ) as HTMLButtonElement | null;
  if (found === null) {
    throw new Error(`enemy cell ${x},${y} missing`);
  }
  return found;
}

function tick(): Promise<void> {
  return new Promise((done) => {
    setTimeout(() => {
      done();
    }, 120);
  });
}

describe("battle screen", () => {
  it("my turn: clicking an unknown enemy cell fires at that coord", async () => {
    const rig = makeRig(snapshotFor(viewFor({}), "ai"));
    const root = newRoot();
    const unmount = mountBattle(root, { controller: rig.controller, onExit: () => {} });

    enemyCell(root, 3, 6).click();
    expect(rig.fired.length).toBe(1);
    const coord = rig.fired[0];
    if (coord !== undefined) {
      expect(formatCoord(coord)).toBe("D7");
    }
    unmount();
  });

  it("my turn: clicking an already-miss cell does not fire", async () => {
    const view: PlayerView = { ...viewFor({}), enemyGrid: withCell(0, 0, "miss") };
    const rig = makeRig(snapshotFor(view, "ai"));
    const root = newRoot();
    const unmount = mountBattle(root, { controller: rig.controller, onExit: () => {} });

    enemyCell(root, 0, 0).click();
    expect(rig.fired.length).toBe(0);
    unmount();
  });

  it("opponent's turn: clicking does nothing and the indicator says enemy", async () => {
    const rig = makeRig(snapshotFor(viewFor({ isMyTurn: false }), "ai"));
    const root = newRoot();
    const unmount = mountBattle(root, { controller: rig.controller, onExit: () => {} });

    enemyCell(root, 1, 1).click();
    expect(rig.fired.length).toBe(0);
    const indicator = queryNode(root, '[data-testid="turn-indicator"]');
    expect(indicator.getAttribute("data-turn")).toBe("enemy");
    expect(indicator.textContent).toBe("Opponent's turn");
    unmount();
  });

  it("last-shot shows a sunk result by me", async () => {
    const view: PlayerView = {
      ...viewFor({}),
      lastShot: {
        by: "p1",
        result: {
          coord: { x: 0, y: 0 },
          outcome: "sunk",
          sunkShip: { type: "destroyer", x: 0, y: 0, orientation: "H" },
        },
      },
    };
    const rig = makeRig(snapshotFor(view, "ai"));
    const root = newRoot();
    const unmount = mountBattle(root, { controller: rig.controller, onExit: () => {} });

    const last = queryNode(root, '[data-testid="last-shot"]');
    expect(last.textContent).toBe("You: A1 sunk destroyer");
    unmount();
  });

  it("finished game I won: game-over visible, rematch calls rematch", async () => {
    const view: PlayerView = { ...viewFor({}), phase: "finished", winner: "p1", isMyTurn: false };
    const rig = makeRig(snapshotFor(view, "ai"));
    const root = newRoot();
    const unmount = mountBattle(root, { controller: rig.controller, onExit: () => {} });

    const dialog = queryNode(root, '[data-testid="game-over"]');
    expect(dialog.hasAttribute("hidden")).toBe(false);
    expect(dialog.getAttribute("data-result")).toBe("win");
    expect(dialog.querySelector("h2")?.textContent).toBe("You win!");
    expect(root.querySelectorAll('[data-testid="btn-menu"]').length).toBe(2);

    queryButton(root, '[data-testid="btn-rematch"]').click();
    expect(rig.rematchCalls.length).toBe(1);
    expect(queryButton(root, '[data-testid="btn-rematch"]').hasAttribute("disabled")).toBe(true);
    unmount();
  });

  it("online snapshots render status-opponent and status-connection", async () => {
    const rig = makeRig(snapshotFor(viewFor({}), "online"));
    const root = newRoot();
    const unmount = mountBattle(root, { controller: rig.controller, onExit: () => {} });

    const status = queryNode(root, '[data-testid="status-opponent"]');
    expect(status.getAttribute("data-status")).toBe("connected");
    expect(queryNode(root, '[data-testid="status-connection"]').getAttribute("data-status")).toBe(
      "open",
    );
    unmount();
  });

  it("ai snapshots have no status elements", async () => {
    const rig = makeRig(snapshotFor(viewFor({}), "ai"));
    const root = newRoot();
    const unmount = mountBattle(root, { controller: rig.controller, onExit: () => {} });

    expect(root.querySelector('[data-testid="status-opponent"]')).toBeNull();
    unmount();
  });

  it("remaining lists carry data-count equal to their length", async () => {
    const rig = makeRig(snapshotFor(viewFor({}), "ai"));
    const root = newRoot();
    const unmount = mountBattle(root, { controller: rig.controller, onExit: () => {} });

    const enemy = queryNode(root, '[data-testid="enemy-remaining"]');
    const mine = queryNode(root, '[data-testid="my-remaining"]');
    expect(enemy.getAttribute("data-count")).toBe("2");
    expect(enemy.querySelectorAll("li").length).toBe(2);
    expect(mine.getAttribute("data-count")).toBe("3");
    expect(mine.querySelectorAll("li").length).toBe(3);
    unmount();
  });

  it("own grid is never clickable, enemy grid follows isMyTurn", async () => {
    const rig = makeRig(snapshotFor(viewFor({ isMyTurn: false }), "ai"));
    const root = newRoot();
    const unmount = mountBattle(root, { controller: rig.controller, onExit: () => {} });

    expect(enemyCell(root, 5, 5).hasAttribute("disabled")).toBe(true);
    expect(
      queryNode(root, '[data-testid="grid-own"] [data-testid="cell"]').hasAttribute("disabled"),
    ).toBe(true);

    rig.push(snapshotFor(viewFor({ isMyTurn: true }), "ai"));
    await tick();
    expect(enemyCell(root, 5, 5).hasAttribute("disabled")).toBe(false);
    unmount();
  });
});
