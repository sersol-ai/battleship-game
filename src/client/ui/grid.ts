import type { Coord, GridView, PlayerView } from "../../shared/types.ts";
import { BOARD_SIZE } from "../../shared/rules.ts";

export type GridKind = "placement" | "own" | "enemy";

export interface GridPreview {
  readonly cells: readonly Coord[];
  readonly ok: boolean;
}

export interface GridDeps {
  grid: GridKind; // fixed at mount → data-testid grid-placement | grid-own | grid-enemy
  view(): PlayerView; // re-read on every re-render
  clickable(): boolean; // false → every cell button is `disabled`
  preview(): GridPreview | null; // placement hover preview; null → no data-preview anywhere
  onCellClick?(x: number, y: number): void; // omitted for grid-own
}

const SYNC_INTERVAL_MS = 100;

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function mountGrid(root: HTMLElement, deps: GridDeps): () => void {
  const host = document.createElement("div");
  host.setAttribute("data-testid", `grid-${deps.grid}`);

  const cells: { button: HTMLButtonElement; x: number; y: number }[] = [];
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const button = document.createElement("button");
      button.setAttribute("data-testid", "cell");
      button.setAttribute("data-x", `${x}`);
      button.setAttribute("data-y", `${y}`);
      button.setAttribute("data-state", "empty");
      button.classList.add("cell");
      host.appendChild(button);
      cells.push({ button, x, y });
    }
  }

  root.innerHTML = "";
  root.appendChild(host);

  function sourceGrid(): GridView {
    const view = deps.view();
    return deps.grid === "enemy" ? view.enemyGrid : view.myGrid;
  }

  function previewKeys(): ReadonlyMap<string, string> {
    const keys = new Map<string, string>();
    const preview = deps.preview();
    if (preview === null) {
      return keys;
    }
    const mark = preview.ok ? "ok" : "bad";
    for (const cell of preview.cells) {
      keys.set(cellKey(cell.x, cell.y), mark);
    }
    return keys;
  }

  function sync(): void {
    const grid = sourceGrid();
    const previews = previewKeys();
    const enabled = deps.clickable();
    for (const cell of cells) {
      const row = grid[cell.y] ?? [];
      cell.button.setAttribute("data-state", row[cell.x] ?? "empty");
      const preview = previews.get(cellKey(cell.x, cell.y));
      if (preview === undefined) {
        cell.button.removeAttribute("data-preview");
      } else {
        cell.button.setAttribute("data-preview", preview);
      }
      cell.button.disabled = !enabled;
    }
  }

  sync();

  const handlers: [HTMLButtonElement, () => void][] = [];
  if (deps.onCellClick !== undefined) {
    for (const cell of cells) {
      const handler = () => {
        if (deps.clickable()) {
          deps.onCellClick?.(cell.x, cell.y);
        }
      };
      cell.button.addEventListener("click", handler);
      handlers.push([cell.button, handler]);
    }
  }

  const timer = setInterval(sync, SYNC_INTERVAL_MS);

  return () => {
    clearInterval(timer);
    for (const [button, handler] of handlers) {
      button.removeEventListener("click", handler);
    }
    root.innerHTML = "";
  };
}
