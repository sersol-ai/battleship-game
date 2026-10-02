import type {
  Board,
  Coord,
  Fleet,
  Result,
  ShipPlacement,
  ShipType,
  ShotError,
  ShotResult,
} from "./types.ts";
import { SHIP_TYPES } from "./rules.ts";
import { inBounds, shipCells, sameCoord } from "./board.ts";

/** { fleet, shotsReceived: [] }. Does NOT validate the fleet (callers do). */
export function createBoard(fleet: Fleet): Board {
  return { fleet, shotsReceived: [] };
}

export function hasBeenShot(board: Board, c: Coord): boolean {
  return board.shotsReceived.some((s) => sameCoord(s, { x: c.x, y: c.y }));
}

/** true iff every cell of ship is in board.shotsReceived. */
export function isShipSunk(board: Board, ship: ShipPlacement): boolean {
  for (const cell of shipCells(ship)) {
    if (!board.shotsReceived.some((s) => sameCoord(s, { x: cell.x, y: cell.y }))) {
      return false;
    }
  }
  return true;
}

/**
 * Errors: !inBounds(c) → "OUT_OF_BOUNDS"; already shot → "ALREADY_SHOT".
 * Otherwise returns a NEW board with c appended to shotsReceived.
 */
export function fireAt(
  board: Board,
  c: Coord,
): Result<{ board: Board; result: ShotResult }, ShotError> {
  if (!inBounds({ x: c.x, y: c.y })) {
    return { ok: false, error: "OUT_OF_BOUNDS" };
  }

  const coord: Coord = { x: c.x, y: c.y };
  if (hasBeenShot(board, coord)) {
    return { ok: false, error: "ALREADY_SHOT" };
  }

  const newShots = [...board.shotsReceived, coord];

  // Check if we hit a ship and if it's sunk
  let matchedShip: ShipPlacement | undefined;
  for (const ship of board.fleet) {
    const cells = shipCells(ship);
    if (cells.some((cell) => sameCoord(cell, coord))) {
      matchedShip = ship;
      break;
    }
  }

  let result: ShotResult;
  if (!matchedShip) {
    result = { coord, outcome: "miss" };
  } else if (isShipSunk({ fleet: board.fleet, shotsReceived: newShots }, matchedShip)) {
    result = { coord, outcome: "sunk", sunkShip: matchedShip };
  } else {
    result = { coord, outcome: "hit" };
  }

  return {
    ok: true,
    value: { board: { fleet: board.fleet, shotsReceived: newShots }, result },
  };
}

/** true iff every ship in the fleet is sunk. */
export function allShipsSunk(board: Board): boolean {
  for (const ship of board.fleet) {
    if (!isShipSunk(board, ship)) return false;
  }
  return true;
}

/** Types of ships NOT yet sunk, in SHIP_TYPES order. */
export function remainingShips(board: Board): ShipType[] {
  return SHIP_TYPES.filter(
    (type) => !board.fleet.some((ship) => ship.type === type && isShipSunk(board, ship)),
  );
}
