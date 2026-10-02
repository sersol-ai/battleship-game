import type {
  Board,
  CellView,
  Coord,
  GridView,
  MatchState,
  PlayerId,
  PlayerView,
  ShipType,
} from "./types.ts";
import { BOARD_SIZE, SHIP_TYPES } from "./rules.ts";
import { isShipSunk } from "./shots.ts";
import { other } from "./match.ts";
import { shipAt, shipCells } from "./board.ts";

/** New BOARD_SIZE×BOARD_SIZE grid, every cell = fill. grid[y][x]. */
function filledGrid(fill: CellView): CellView[][] {
  const grid: CellView[][] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    grid[y] = new Array(BOARD_SIZE).fill(fill) as CellView[];
  }
  return grid;
}

/** Mark all cells belonging to `ship` with `value`. Uses non-null asserts because grid rows are always length BOARD_SIZE. */
function markShip(grid: CellView[][], ship: any, value: CellView): void {
  const cells = shipCells(ship);
  for (const cell of cells) {
    grid[cell.y]![cell.x] = value;
  }
}

/**
 * My own board. null → all "empty".
 * Else start all "empty"; every fleet cell → "ship"; then for every shot received:
 *   no ship there → "miss"; ship there and that ship sunk → "sunk"; else → "hit".
 */
export function ownGrid(board: Board | null): GridView {
  if (!board) {
    return filledGrid("empty") as GridView;
  }

  const grid: CellView[][] = filledGrid("empty");

  // Mark all fleet cells as "ship"
  for (const ship of board.fleet) {
    markShip(grid, ship, "ship");
  }

  // Overlay shots
  for (const shot of board.shotsReceived) {
    const ship = shipAt(board.fleet, shot);
    if (!ship) {
      grid[shot.y]![shot.x] = "miss";
    } else if (isShipSunk(board, ship)) {
      markShip(grid, ship, "sunk");
    } else {
      grid[shot.y]![shot.x] = "hit";
    }
  }

  return grid as GridView;
}

/**
 * Opponent's board as I see it. null → all "unknown".
 * Else start all "unknown"; shots exactly as ownGrid ("miss"/"hit"/"sunk").
 * If reveal: every fleet cell still "unknown" becomes "ship".
 */
export function enemyGrid(board: Board | null, reveal: boolean): GridView {
  if (!board) {
    return filledGrid("unknown") as GridView;
  }

  const grid: CellView[][] = filledGrid("unknown");

  for (const shot of board.shotsReceived) {
    const ship = shipAt(board.fleet, shot);
    if (!ship) {
      grid[shot.y]![shot.x] = "miss";
    } else if (isShipSunk(board, ship)) {
      markShip(grid, ship, "sunk");
    } else {
      grid[shot.y]![shot.x] = "hit";
    }
  }

  if (reveal) {
    for (const ship of board.fleet) {
      markShip(grid, ship, "ship");
    }
  }

  return grid as GridView;
}

/** {x:1,y:6} → "B7". Columns A–J, rows 1–10. */
export function formatCoord(c: Coord): string {
  return `${String.fromCharCode(65 + c.x)}${c.y + 1}`;
}

/** Ship types not yet sunk, in SHIP_TYPES order. */
function shipsRemaining(board: Board | null): readonly ShipType[] {
  if (!board) return SHIP_TYPES;
  return SHIP_TYPES.filter(
    (type) => !board.fleet.some((ship) => ship.type === type && isShipSunk(board, ship)),
  );
}

/** Build the complete player view from a MatchState. */
export function toPlayerView(state: MatchState, me: PlayerId): PlayerView {
  const opp = other(me);
  const myBoard = state.boards[me];
  const oppBoard = state.boards[opp];
  const lastHistory = state.history[state.history.length > 0 ? state.history.length - 1 : 0];

  return {
    me,
    phase: state.phase,
    isMyTurn: state.phase === "playing" && state.turn === me,
    winner: state.winner,
    myPlaced: myBoard !== null,
    enemyPlaced: oppBoard !== null,
    myGrid: ownGrid(myBoard),
    enemyGrid: enemyGrid(oppBoard, state.phase === "finished"),
    myShipsRemaining: shipsRemaining(myBoard),
    enemyShipsRemaining: shipsRemaining(oppBoard),
    lastShot: lastHistory ?? null,
  } as PlayerView;
}
