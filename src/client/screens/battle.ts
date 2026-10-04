// CONTRACT-adjacent (T-12): the battle screen. Talks ONLY to a GameController.
// Two shared grid components (T-10): own fleet (never clickable) and enemy waters.

import type { ControllerSnapshot, GameController } from "../controller.ts";
import type {
  CellView,
  Coord,
  GridView,
  PlayerId,
  PlayerView,
  ShipType,
  ShotOutcome,
  ShotResult,
  Phase,
} from "../../shared/types.ts";
import type { OpponentStatus } from "../../shared/protocol.ts";
import type { ConnectionState } from "../controller.ts";
import { formatCoord } from "../../shared/view.ts";
import { mountGrid } from "../ui/grid.ts";

const SHIP_NAMES: Record<ShipType, string> = {
  carrier: "Carrier",
  battleship: "Battleship",
  cruiser: "Cruiser",
  submarine: "Submarine",
  destroyer: "Destroyer",
};

function emptyGrid(): GridView {
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

function shotText(
  view: PlayerView,
  last: { readonly by: PlayerId; readonly result: ShotResult } | null,
): string {
  if (last === null) {
    return "";
  }
  const who = last.by === view.me ? "You" : "Enemy";
  const label =
    last.result.outcome === "sunk"
      ? `sunk ${last.result.sunkShip?.type ?? ""}`
      : last.result.outcome;
  return `${who}: ${formatCoord(last.result.coord)} ${label}`;
}

export interface BattleDeps {
  controller: GameController;
  onExit(): void;
}

export function mountBattle(root: HTMLElement, deps: BattleDeps): () => void {
  let snapshot: ControllerSnapshot = deps.controller.getSnapshot();

  const section = document.createElement("section");
  section.setAttribute("data-testid", "screen-battle");
  root.innerHTML = "";
  root.appendChild(section);

  const header = document.createElement("header");
  const turnIndicator = document.createElement("div");
  turnIndicator.setAttribute("data-testid", "turn-indicator");
  header.appendChild(turnIndicator);
  const headerMenu = document.createElement("button");
  headerMenu.setAttribute("data-testid", "btn-menu");
  headerMenu.textContent = "Menu";
  headerMenu.addEventListener("click", () => {
    deps.onExit();
  });
  header.appendChild(headerMenu);

  let statusOpponent: HTMLElement | null = null;
  let statusConnection: HTMLElement | null = null;
  if (snapshot.mode === "online") {
    statusOpponent = document.createElement("div");
    statusOpponent.setAttribute("data-testid", "status-opponent");
    header.appendChild(statusOpponent);
    statusConnection = document.createElement("div");
    statusConnection.setAttribute("data-testid", "status-connection");
    header.appendChild(statusConnection);
  }
  section.appendChild(header);

  const boards = document.createElement("div");
  boards.setAttribute("class", "boards");
  const ownHost = document.createElement("div");
  const enemyHost = document.createElement("div");
  boards.appendChild(ownHost);
  boards.appendChild(enemyHost);
  section.appendChild(boards);

  const myRemaining = document.createElement("ul");
  myRemaining.setAttribute("data-testid", "my-remaining");
  section.appendChild(myRemaining);
  const enemyRemaining = document.createElement("ul");
  enemyRemaining.setAttribute("data-testid", "enemy-remaining");
  section.appendChild(enemyRemaining);

  const lastShot = document.createElement("p");
  lastShot.setAttribute("data-testid", "last-shot");
  section.appendChild(lastShot);

  const errorLine = document.createElement("p");
  errorLine.setAttribute("class", "error");
  section.appendChild(errorLine);

  const gameOver = document.createElement("div");
  gameOver.setAttribute("data-testid", "game-over");
  gameOver.setAttribute("role", "dialog");
  gameOver.setAttribute("hidden", "");
  const gameOverHeading = document.createElement("h2");
  gameOver.appendChild(gameOverHeading);
  const rematchButton = document.createElement("button");
  rematchButton.setAttribute("data-testid", "btn-rematch");
  rematchButton.textContent = "Play again";
  gameOver.appendChild(rematchButton);
  const dialogMenu = document.createElement("button");
  dialogMenu.setAttribute("data-testid", "btn-menu");
  dialogMenu.textContent = "Menu";
  gameOver.appendChild(dialogMenu);
  section.appendChild(gameOver);

  function currentView(): PlayerView {
    const view = snapshot.view;
    return view === null
      ? {
          me: "p1",
          phase: "placing",
          isMyTurn: false,
          winner: null,
          myPlaced: false,
          enemyPlaced: false,
          myGrid: emptyGrid(),
          enemyGrid: emptyGrid(),
          enemyShipsRemaining: [],
          myShipsRemaining: [],
          lastShot: null,
        }
      : view;
  }

  function enemyClickable(): boolean {
    const view = snapshot.view;
    return view !== null && view.isMyTurn;
  }

  const unmountOwnGrid = mountGrid(ownHost, {
    grid: "own",
    view: currentView,
    clickable: () => false,
    preview: () => null,
  });

  const unmountEnemyGrid = mountGrid(enemyHost, {
    grid: "enemy",
    view: currentView,
    clickable: enemyClickable,
    preview: () => null,
    onCellClick(x: number, y: number): void {
      const view = snapshot.view;
      if (view === null || !view.isMyTurn) {
        return;
      }
      const row = view.enemyGrid[y] ?? [];
      if ((row[x] ?? "unknown") !== "unknown") {
        return;
      }
      deps.controller.fire({ x, y });
    },
  });

  function render(): void {
    const view = snapshot.view;
    const phase: Phase = view === null ? "placing" : view.phase;
    const finished = phase === "finished";

    if (view === null || phase !== "playing") {
      turnIndicator.setAttribute("data-turn", "none");
      turnIndicator.textContent = finished ? "Game over" : "Waiting";
    } else {
      turnIndicator.setAttribute("data-turn", view.isMyTurn ? "me" : "enemy");
      turnIndicator.textContent = view.isMyTurn ? "Your turn" : "Opponent's turn";
    }

    if (statusOpponent !== null && statusConnection !== null) {
      statusOpponent.setAttribute("data-status", snapshot.opponent);
      statusOpponent.textContent = String(snapshot.opponent);
      statusConnection.setAttribute("data-status", snapshot.connection);
      statusConnection.textContent = String(snapshot.connection);
    }

    const myLeft = view === null ? [] : view.myShipsRemaining;
    const enemyLeft = view === null ? [] : view.enemyShipsRemaining;
    fillList(myRemaining, myLeft);
    fillList(enemyRemaining, enemyLeft);

    const shot = view === null ? null : view.lastShot;
    lastShot.textContent = view === null ? "" : shotText(view, view.lastShot ?? null);

    if (snapshot.error === null) {
      errorLine.removeAttribute("hidden");
      errorLine.textContent = "";
    } else {
      errorLine.textContent = snapshot.error;
    }

    if (view !== null && finished) {
      const won = view.winner === view.me;
      gameOver.removeAttribute("hidden");
      gameOver.setAttribute("data-result", won ? "win" : "lose");
      gameOverHeading.textContent = won ? "You win!" : "You lose";
      headerMenu.setAttribute("hidden", "");
      rematchButton.removeAttribute("disabled");
    } else {
      gameOver.setAttribute("hidden", "");
      gameOver.removeAttribute("data-result");
      gameOverHeading.textContent = "";
      rematchButton.textContent = "Play again";
      headerMenu.removeAttribute("hidden");
    }
  }

  function fillList(list: HTMLElement, types: readonly ShipType[]): void {
    list.setAttribute("data-count", `${types.length}`);
    list.innerHTML = "";
    for (const type of types) {
      const item = document.createElement("li");
      item.textContent = SHIP_NAMES[type];
      list.appendChild(item);
    }
  }

  rematchButton.addEventListener("click", () => {
    deps.controller.rematch();
    rematchButton.textContent = "Waiting for opponent\u2026";
    rematchButton.toggleAttribute("disabled", true);
  });

  dialogMenu.addEventListener("click", () => {
    deps.onExit();
  });

  const unsubscribe = deps.controller.subscribe((next) => {
    snapshot = next;
    render();
  });

  render();

  return () => {
    unsubscribe();
    unmountOwnGrid();
    unmountEnemyGrid();
    root.innerHTML = "";
  };
}
