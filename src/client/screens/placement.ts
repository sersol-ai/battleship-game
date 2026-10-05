// CONTRACT-adjacent (T-11): the placement screen. Talks ONLY to a GameController.
// Owns ship selection/rotation/random/reset and paints the shared grid component.

import type { ControllerSnapshot, GameController } from "../controller.ts";
import type { Rng } from "../../shared/types.ts";
import type {
  CellView,
  Coord,
  Fleet,
  GridView,
  Orientation,
  PlacementError,
  PlayerView,
  ShipPlacement,
  ShipType,
} from "../../shared/types.ts";
import { BOARD_SIZE, FLEET_SPEC, SHIP_TYPES } from "../../shared/rules.ts";
import { createBoard } from "../../shared/shots.ts";
import { ownGrid } from "../../shared/view.ts";
import { randomFleet } from "../../shared/placement.ts";
import { shipAt, shipCells, validateShip } from "../../shared/board.ts";
import { mountGrid } from "../ui/grid.ts";
import type { GridPreview } from "../ui/grid.ts";

function emptyGrid(): GridView {
  const rows: CellView[][] = [];
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    const row: CellView[] = [];
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      row.push("unknown");
    }
    rows.push(row);
  }
  return rows;
}

const ERROR_TEXT: Record<PlacementError, string> = {
  WRONG_FLEET: "Fleet is incomplete.",
  OUT_OF_BOUNDS: "Ship doesn't fit there.",
  OVERLAP: "Ships can't overlap.",
  ADJACENT: "Ships can't touch.",
};

const SQUARE = "\u25AA"; // ▪

function fleetOf(placed: Map<ShipType, ShipPlacement>): Fleet {
  return SHIP_TYPES.flatMap((type) => {
    const ship = placed.get(type);
    return ship === undefined ? [] : [ship];
  });
}

function firstUnplaced(placed: Map<ShipType, ShipPlacement>): ShipType | null {
  for (const type of SHIP_TYPES) {
    if (!placed.has(type)) {
      return type;
    }
  }
  return null;
}

function others(placed: Map<ShipType, ShipPlacement>, selected: ShipType): Fleet {
  return SHIP_TYPES.flatMap((type) => {
    if (type === selected) {
      return [];
    }
    const ship = placed.get(type);
    return ship === undefined ? [] : [ship];
  });
}

export interface PlacementDeps {
  readonly controller: GameController;
  readonly rng: Rng;
  readonly onExit: () => void;
}

export function mountPlacement(root: HTMLElement, deps: PlacementDeps): () => void {
  const placed = new Map<ShipType, ShipPlacement>();
  let selected: ShipType | null = "carrier";
  let orientation: Orientation = "H";
  let submitted = false;
  let waiting = false;
  let preview: GridPreview | null = null;

  const section = document.createElement("section");
  section.setAttribute("data-testid", "screen-placement");
  root.innerHTML = "";
  root.appendChild(section);

  const header = document.createElement("header");
  const title = document.createElement("h1");
  title.textContent = "Place your ships";
  header.appendChild(title);
  const menuButton = document.createElement("button");
  menuButton.setAttribute("data-testid", "btn-menu");
  menuButton.textContent = "Menu";
  menuButton.addEventListener("click", () => {
    deps.onExit();
  });
  header.appendChild(menuButton);
  section.appendChild(header);

  const shipButtons = new Map<ShipType, HTMLElement>();
  for (const type of SHIP_TYPES) {
    const button = document.createElement("button");
    button.setAttribute("data-testid", `ship-${type}`);
    button.textContent = `${type} ${SQUARE.repeat(FLEET_SPEC[type])}`;
    button.addEventListener("click", () => {
      selectShip(type);
    });
    shipButtons.set(type, button);
    section.appendChild(button);
  }

  const rotateButton = document.createElement("button");
  rotateButton.setAttribute("data-testid", "btn-rotate");
  rotateButton.textContent = "Rotate";
  rotateButton.addEventListener("click", () => {
    orientation = orientation === "H" ? "V" : "H";
    refresh();
  });
  section.appendChild(rotateButton);

  const randomButton = document.createElement("button");
  randomButton.setAttribute("data-testid", "btn-random");
  randomButton.textContent = "Random";
  randomButton.addEventListener("click", () => {
    placed.clear();
    for (const ship of randomFleet(deps.rng)) {
      placed.set(ship.type, ship);
    }
    selected = null;
    refresh();
  });
  section.appendChild(randomButton);

  const resetButton = document.createElement("button");
  resetButton.setAttribute("data-testid", "btn-reset");
  resetButton.textContent = "Reset";
  resetButton.addEventListener("click", () => {
    placed.clear();
    selected = "carrier";
    refresh();
  });
  section.appendChild(resetButton);

  const gridHost = document.createElement("div");
  section.appendChild(gridHost);

  const errorText = document.createElement("p");
  errorText.setAttribute("data-testid", "placement-error");
  section.appendChild(errorText);

  const readyButton = document.createElement("button");
  readyButton.setAttribute("data-testid", "btn-ready");
  readyButton.textContent = "Ready";
  readyButton.addEventListener("click", () => {
    if (placed.size !== SHIP_TYPES.length) {
      return;
    }
    submitted = true;
    deps.controller.place(fleetOf(placed));
    refresh();
  });
  section.appendChild(readyButton);

  const waitingText = document.createElement("p");
  waitingText.setAttribute("data-testid", "placement-waiting");
  waitingText.setAttribute("hidden", "");
  section.appendChild(waitingText);

  function showError(text: string): void {
    errorText.textContent = text;
  }

  function clearError(): void {
    errorText.textContent = "";
  }

  function selectShip(type: ShipType): void {
    const current = placed.get(type);
    if (current !== undefined) {
      placed.delete(type);
      selected = type;
      orientation = current.orientation;
      clearError();
    } else {
      selected = type;
    }
    refresh();
  }

  function handleCellClick(c: Coord): void {
    if (waiting) {
      return;
    }
    const existing = shipAt(fleetOf(placed), c);
    if (existing !== undefined) {
      placed.delete(existing.type);
      selected = existing.type;
      orientation = existing.orientation;
      clearError();
      refresh();
      return;
    }
    if (selected === null) {
      return;
    }
    const candidate: ShipPlacement = {
      type: selected,
      x: c.x,
      y: c.y,
      orientation,
    };
    const error = validateShip(candidate, others(placed, selected));
    if (error !== null) {
      showError(ERROR_TEXT[error]);
      return;
    }
    placed.set(selected, candidate);
    clearError();
    selected = firstUnplaced(placed);
    refresh();
  }

  function setPreviewFor(c: Coord): void {
    if (selected === null) {
      preview = null;
      return;
    }
    const candidate: ShipPlacement = {
      type: selected,
      x: c.x,
      y: c.y,
      orientation,
    };
    preview = {
      cells: shipCells(candidate),
      ok: validateShip(candidate, others(placed, selected)) === null,
    };
  }

  function refresh(): void {
    const fleet = fleetOf(placed);
    for (const type of SHIP_TYPES) {
      const button = shipButtons.get(type) ?? menuButton;
      if (placed.has(type)) {
        button.setAttribute("data-placed", "true");
      } else {
        button.removeAttribute("data-placed");
      }
      if (type === selected) {
        button.setAttribute("data-selected", "true");
      } else {
        button.removeAttribute("data-selected");
      }
    }
    rotateButton.setAttribute("data-orientation", orientation);
    readyButton.toggleAttribute("disabled", placed.size !== SHIP_TYPES.length);
    if (waiting) {
      waitingText.removeAttribute("hidden");
      waitingText.textContent = "Waiting for opponent\u2026";
      readyButton.toggleAttribute("disabled", true);
    } else {
      waitingText.setAttribute("hidden", "");
      waitingText.textContent = "";
    }
  }

  function gridBoard(): PlayerView {
    return {
      me: "p1",
      phase: "placing",
      isMyTurn: false,
      winner: null,
      myPlaced: submitted,
      enemyPlaced: false,
      myGrid: ownGrid(createBoard(fleetOf(placed))),
      enemyGrid: emptyGrid(),
      enemyShipsRemaining: [],
      myShipsRemaining: [],
      lastShot: null,
    };
  }

  const unmountGrid = mountGrid(gridHost, {
    grid: "placement",
    view: gridBoard,
    clickable: () => !waiting,
    preview: () => preview,
    onCellClick(x: number, y: number): void {
      handleCellClick({ x, y });
    },
  });

  for (const button of section.querySelectorAll('[data-testid="cell"]')) {
    const x = Number(button.getAttribute("data-x"));
    const y = Number(button.getAttribute("data-y"));
    button.addEventListener("mouseover", () => {
      setPreviewFor({ x, y });
    });
    button.addEventListener("mouseout", () => {
      preview = null;
    });
  }

  function onKey(ev: KeyboardEvent): void {
    if (ev.key === "r" || ev.key === "R") {
      orientation = orientation === "H" ? "V" : "H";
      refresh();
    }
  }

  document.addEventListener("keydown", onKey);

  const unsubscribe = deps.controller.subscribe((snapshot) => {
    if (snapshot.error !== null && submitted) {
      showError(snapshot.error);
      submitted = false;
      refresh();
    }
    if (snapshot.view !== null && snapshot.view.myPlaced) {
      waiting = true;
      refresh();
    }
  });

  refresh();

  return () => {
    unsubscribe();
    unmountGrid();
    document.removeEventListener("keydown", onKey);
    root.innerHTML = "";
  };
}
