// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { mountPlacement } from "./placement.ts";
import type { PlacementDeps } from "./placement.ts";
import type { ControllerSnapshot, GameController } from "../controller.ts";
import { createRng } from "../../shared/rng.ts";
import type { Fleet } from "../../shared/types.ts";

const CARRIER_CELLS: Array<[number, number]> = [
  [0, 0],
  [1, 0],
  [2, 0],
  [3, 0],
  [4, 0],
];

function tick(): Promise<void> {
  return new Promise((done) => {
    setTimeout(() => {
      done();
    }, 120);
  });
}

interface Rig {
  readonly controller: GameController;
  readonly push: (snapshot: ControllerSnapshot) => void;
  readonly placeFleets: Array<Fleet>;
}

function makeRig(): Rig {
  let snapshot: ControllerSnapshot = {
    view: null,
    mode: "ai",
    connection: "open",
    opponent: "connected",
    room: null,
    error: null,
  };
  const listeners: Array<(snapshot: ControllerSnapshot) => void> = [];
  const place = vi.fn();
  const placeFleets: Array<Fleet> = [];
  const controller: GameController = {
    subscribe: (listener) => {
      listeners.push(listener);
      listener(snapshot);
      return () => {
        listeners.length = 0;
      };
    },
    getSnapshot: () => snapshot,
    place: (fleet) => {
      place.call(fleet);
      placeFleets.push(fleet);
    },
    fire: () => {},
    rematch: () => {},
    dispose: () => {},
  };
  return {
    controller,
    push: (next) => {
      snapshot = next;
      for (const listener of listeners) {
        listener(next);
      }
    },
    placeFleets,
  };
}

function newRoot(): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("data-testid", "placement-root");
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

function readyButton(root: HTMLElement): HTMLButtonElement {
  return queryButton(root, '[data-testid="btn-ready"]');
}

function cellButton(root: HTMLElement, x: number, y: number): HTMLButtonElement {
  return queryButton(root, `[data-testid="cell"][data-x="${x}"][data-y="${y}"]`);
}

function shipButton(root: HTMLElement, type: string): HTMLButtonElement {
  return queryButton(root, `[data-testid="ship-${type}"]`);
}

function errorText(root: HTMLElement): string {
  const found = root.querySelector('[data-testid="placement-error"]');
  return found === null ? "" : found.textContent;
}

describe("placement screen", () => {
  it("Ready is disabled until the whole fleet is placed", async () => {
    const rig = makeRig();
    const root = newRoot();
    const unmount = mountPlacement(root, {
      controller: rig.controller,
      rng: createRng(1),
      onExit: () => {},
    });

    expect(readyButton(root).hasAttribute("disabled")).toBe(true);
    unmount();
  });

  it("Random places 5 ships and enables Ready", async () => {
    const rig = makeRig();
    const root = newRoot();
    const unmount = mountPlacement(root, {
      controller: rig.controller,
      rng: createRng(7),
      onExit: () => {},
    });

    queryButton(root, '[data-testid="btn-random"]').click();

    for (const type of ["carrier", "battleship", "cruiser", "submarine", "destroyer"]) {
      expect(shipButton(root, type).getAttribute("data-placed")).toBe("true");
    }
    expect(readyButton(root).hasAttribute("disabled")).toBe(false);
    unmount();
  });

  it("clicking A1 with the carrier horizontal places cells (0..4, 0)", async () => {
    const rig = makeRig();
    const root = newRoot();
    const unmount = mountPlacement(root, {
      controller: rig.controller,
      rng: createRng(1),
      onExit: () => {},
    });

    cellButton(root, 0, 0).click();
    await tick();

    for (const [x, y] of CARRIER_CELLS) {
      expect(cellButton(root, x, y).getAttribute("data-state")).toBe("ship");
    }
    unmount();
  });

  it("clicking B2 next to that carrier shows the ADJACENT message", async () => {
    const rig = makeRig();
    const root = newRoot();
    const unmount = mountPlacement(root, {
      controller: rig.controller,
      rng: createRng(1),
      onExit: () => {},
    });

    cellButton(root, 0, 0).click();
    await tick();
    cellButton(root, 1, 1).click();

    expect(errorText(root)).toBe("Ships can't touch.");
    unmount();
  });

  it("btn-rotate toggles data-orientation", async () => {
    const rig = makeRig();
    const root = newRoot();
    const unmount = mountPlacement(root, {
      controller: rig.controller,
      rng: createRng(1),
      onExit: () => {},
    });

    const rotate = queryButton(root, '[data-testid="btn-rotate"]');
    expect(rotate.getAttribute("data-orientation")).toBe("H");
    rotate.click();
    expect(rotate.getAttribute("data-orientation")).toBe("V");
    unmount();
  });

  it("clicking a placed carrier cell picks it up", async () => {
    const rig = makeRig();
    const root = newRoot();
    const unmount = mountPlacement(root, {
      controller: rig.controller,
      rng: createRng(1),
      onExit: () => {},
    });

    cellButton(root, 0, 0).click();
    await tick();
    expect(shipButton(root, "carrier").hasAttribute("data-placed")).toBe(true);

    cellButton(root, 2, 0).click();
    await tick();

    expect(shipButton(root, "carrier").hasAttribute("data-placed")).toBe(false);
    expect(cellButton(root, 2, 0).getAttribute("data-state")).toBe("empty");
    unmount();
  });

  it("Ready sends the 5-ship fleet to the controller", async () => {
    const rig = makeRig();
    const root = newRoot();
    const unmount = mountPlacement(root, {
      controller: rig.controller,
      rng: createRng(3),
      onExit: () => {},
    });

    queryButton(root, '[data-testid="btn-random"]').click();
    queryButton(root, '[data-testid="btn-ready"]').click();

    expect(rig.placeFleets.length).toBe(1);
    const fleet = rig.placeFleets[0];
    if (fleet === undefined) {
      throw new Error("no fleet placed");
    }
    expect(fleet.length).toBe(5);
    unmount();
  });

  it("the controller can report an error and clear the Ready state", async () => {
    const rig = makeRig();
    const root = newRoot();
    const unmount = mountPlacement(root, {
      controller: rig.controller,
      rng: createRng(3),
      onExit: () => {},
    });

    queryButton(root, '[data-testid="btn-random"]').click();
    queryButton(root, '[data-testid="btn-ready"]').click();
    rig.push({
      view: null,
      mode: "ai",
      connection: "open",
      opponent: "connected",
      room: null,
      error: "Your ships are not placed.",
    });

    expect(errorText(root)).toBe("Your ships are not placed.");
    expect(readyButton(root).hasAttribute("disabled")).toBe(false);
    unmount();
  });

  it("after the controller says placed, the screen waits and disables controls", async () => {
    const rig = makeRig();
    const root = newRoot();
    const unmount = mountPlacement(root, {
      controller: rig.controller,
      rng: createRng(3),
      onExit: () => {},
    });

    const view: ControllerSnapshot = {
      view: {
        me: "p1",
        phase: "placing",
        isMyTurn: false,
        winner: null,
        myPlaced: true,
        enemyPlaced: false,
        myGrid: [],
        enemyGrid: [],
        enemyShipsRemaining: [],
        myShipsRemaining: [],
        lastShot: null,
      },
      mode: "ai",
      connection: "open",
      opponent: "connected",
      room: null,
      error: null,
    };
    rig.push(view);

    const waiting = root.querySelector('[data-testid="placement-waiting"]');
    expect(waiting === null ? "" : waiting.textContent).toBe("Waiting for opponent\u2026");
    expect(readyButton(root).hasAttribute("disabled")).toBe(true);
    unmount();
  });
});
