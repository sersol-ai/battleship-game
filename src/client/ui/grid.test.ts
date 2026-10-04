// @vitest-environment happy-dom
import type { CellView, PlayerView } from "../../shared/types.ts";
import type { GridKind, GridPreview } from "./grid.ts";
import { BOARD_SIZE } from "../../shared/rules.ts";
import { mountGrid } from "./grid.ts";
import { describe, it, expect } from "vitest";

function makeGrid(states: (x: number, y: number) => CellView): PlayerView["myGrid"] {
  const rows: CellView[][] = [];
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    const row: CellView[] = [];
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      row.push(states(x, y));
    }
    rows.push(row);
  }
  return rows;
}

function view(myGrid: PlayerView["myGrid"], enemyGrid: PlayerView["myGrid"]): PlayerView {
  return {
    me: "p1",
    phase: "playing",
    isMyTurn: true,
    winner: null,
    myPlaced: true,
    enemyPlaced: true,
    myGrid,
    enemyGrid,
    enemyShipsRemaining: [],
    myShipsRemaining: [],
    lastShot: null,
  };
}

function cellOf(root: HTMLElement, x: number, y: number): HTMLButtonElement {
  const found = root.querySelector(`[data-testid=cell][data-x="${x}"][data-y="${y}"]`);
  if (found === null) {
    throw new Error(`no cell at ${x},${y}`);
  }
  return found as HTMLButtonElement;
}

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("grid", () => {
  it("renders 100 cells with coordinates and states from the view", async () => {
    const own = makeGrid((x, y) => (x === 3 && y === 4 ? "ship" : "empty"));
    const enemy = makeGrid((x, y) => (x === 1 && y === 9 ? "hit" : "unknown"));
    const root = document.createElement("div");
    const unmount = mountGrid(root, {
      grid: "own",
      view: () => view(own, enemy),
      clickable: () => false,
      preview: () => null,
    });

    expect(root.querySelectorAll("[data-testid=grid-own]").length).toBe(1);
    const cells = root.querySelectorAll("[data-testid=cell]");
    expect(cells.length).toBe(100);
    expect(cellOf(root, 3, 4).getAttribute("data-state")).toBe("ship");
    expect(cellOf(root, 0, 0).getAttribute("data-state")).toBe("empty");
    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        expect(cellOf(root, x, y).getAttribute("data-x")).toBe(`${x}`);
        expect(cellOf(root, x, y).getAttribute("data-y")).toBe(`${y}`);
      }
    }
    unmount();
  });

  it("picks the enemy grid for grid-enemy and disables cells when not clickable", async () => {
    const own = makeGrid((_, y) => (y === 0 ? "ship" : "empty"));
    const enemy = makeGrid((x, y) => (x === 5 && y === 5 ? "miss" : "unknown"));
    const root = document.createElement("div");
    let enabled = false;
    const unmount = mountGrid(root, {
      grid: "enemy",
      view: () => view(own, enemy),
      clickable: () => enabled,
      preview: () => null,
    });

    expect(cellOf(root, 5, 5).getAttribute("data-state")).toBe("miss");
    expect(cellOf(root, 0, 0).getAttribute("data-state")).toBe("unknown");
    expect(cellOf(root, 5, 5).disabled).toBe(true);
    enabled = true;
    await sleep(120);
    expect(cellOf(root, 5, 5).disabled).toBe(false);
    unmount();
  });

  it("reports a clicked cell as its x,y", async () => {
    const clicked: [number, number][] = [];
    const root = document.createElement("div");
    const unmount = mountGrid(root, {
      grid: "enemy",
      view: () =>
        view(
          makeGrid(() => "empty"),
          makeGrid(() => "unknown"),
        ),
      clickable: () => true,
      preview: () => null,
      onCellClick(x, y) {
        clicked.push([x, y]);
      },
    });

    const target = cellOf(root, 7, 2);
    target.click();
    cellOf(root, 0, 9).click();
    expect(clicked).toEqual([
      [7, 2],
      [0, 9],
    ]);
    unmount();
    target.click();
    expect(clicked).toEqual([
      [7, 2],
      [0, 9],
    ]);
  });

  it("marks preview cells ok or bad and clears stale marks", async () => {
    const root = document.createElement("div");
    let preview: GridPreview | null = {
      cells: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      ok: true,
    };
    const unmount = mountGrid(root, {
      grid: "placement",
      view: () =>
        view(
          makeGrid(() => "empty"),
          makeGrid(() => "unknown"),
        ),
      clickable: () => true,
      preview: () => preview,
    });

    expect(cellOf(root, 0, 0).getAttribute("data-preview")).toBe("ok");
    expect(cellOf(root, 1, 0).getAttribute("data-preview")).toBe("ok");
    expect(cellOf(root, 2, 0).getAttribute("data-preview")).toBeNull();
    preview = { cells: [{ x: 1, y: 0 }], ok: false };
    await sleep(120);
    expect(cellOf(root, 1, 0).getAttribute("data-preview")).toBe("bad");
    expect(cellOf(root, 0, 0).getAttribute("data-preview")).toBeNull();
    unmount();
  });

  it("re-renders when the view changes", async () => {
    let current = view(
      makeGrid(() => "empty"),
      makeGrid(() => "unknown"),
    );
    const root = document.createElement("div");
    const unmount = mountGrid(root, {
      grid: "own",
      view: () => current,
      clickable: () => false,
      preview: () => null,
    });
    expect(cellOf(root, 2, 6).getAttribute("data-state")).toBe("empty");

    current = view(
      makeGrid((x, y) => (x === 2 && y === 6 ? "sunk" : "empty")),
      current.enemyGrid,
    );
    await sleep(120);
    expect(cellOf(root, 2, 6).getAttribute("data-state")).toBe("sunk");
    unmount();
  });

  it("unmount clears the grid and stops the interval", async () => {
    let current = view(
      makeGrid(() => "empty"),
      makeGrid(() => "unknown"),
    );
    const root = document.createElement("div");
    const unmount = mountGrid(root, {
      grid: "own",
      view: () => current,
      clickable: () => false,
      preview: () => null,
      onCellClick(x, y) {
        void x;
        void y;
      },
    });
    expect(root.querySelectorAll("[data-testid=cell]").length).toBe(100);

    unmount();
    expect(root.querySelectorAll("[data-testid=cell]").length).toBe(0);
    current = view(
      makeGrid(() => "hit"),
      current.enemyGrid,
    );
    await sleep(120);
    expect(root.querySelectorAll("[data-testid=cell]").length).toBe(0);
  });
});
