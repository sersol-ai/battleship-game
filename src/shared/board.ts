import type { Coord, Fleet, PlacementError, Result, ShipPlacement, ShipType } from "./types.ts";
import { ALLOW_ADJACENT_SHIPS, BOARD_SIZE, FLEET_SPEC, SHIP_TYPES } from "./rules.ts";

/** "x,y" — use as Set/Map key. */
export function coordKey(c: Coord): string {
  return `${c.x},${c.y}`;
}

export function sameCoord(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}

/** true iff x and y are integers and 0 <= x,y < BOARD_SIZE. */
export function inBounds(c: Coord): boolean {
  return (
    Number.isInteger(c.x) &&
    Number.isInteger(c.y) &&
    c.x >= 0 &&
    c.x < BOARD_SIZE &&
    c.y >= 0 &&
    c.y < BOARD_SIZE
  );
}

/**
 * The FLEET_SPEC[ship.type] cells from (x,y): H → x, x+1, …; V → y, y+1, …
 * (may be out of bounds).
 */
export function shipCells(ship: ShipPlacement): Coord[] {
  const cells: Coord[] = [];
  const length = FLEET_SPEC[ship.type];
  for (let k = 0; k < length; k++) {
    cells.push(
      ship.orientation === "H" ? { x: ship.x + k, y: ship.y } : { x: ship.x, y: ship.y + k },
    );
  }
  return cells;
}

/** The up-to-8 in-bounds cells around c (never c itself). */
export function neighbors8(c: Coord): Coord[] {
  const result: Coord[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const n: Coord = { x: c.x + dx, y: c.y + dy };
      if (inBounds(n)) result.push(n);
    }
  }
  return result;
}

/** The up-to-4 in-bounds cells left/right/up/down of c. */
export function neighbors4(c: Coord): Coord[] {
  const dirs: Coord[] = [
    { x: c.x - 1, y: c.y },
    { x: c.x + 1, y: c.y },
    { x: c.x, y: c.y - 1 },
    { x: c.x, y: c.y + 1 },
  ];
  return dirs.filter(inBounds);
}

/** First ship in fleet occupying c, or undefined. */
export function shipAt(fleet: Fleet, c: Coord): ShipPlacement | undefined {
  for (const ship of fleet) {
    const cells = shipCells(ship);
    if (cells.some((cell) => sameCoord(cell, c))) return ship;
  }
  return undefined;
}

/**
 * Can `ship` be added to `others`? Ships in `others` with the same `type` as `ship`
 * are IGNORED (the UI uses this when moving a ship).
 */
export function validateShip(ship: ShipPlacement, others: Fleet): PlacementError | null {
  // 1. OUT_OF_BOUNDS
  for (const cell of shipCells(ship)) {
    if (!inBounds(cell)) return "OUT_OF_BOUNDS";
  }

  // 2. OVERLAP
  for (const other of others) {
    if (other.type === ship.type) continue; // ignore same-type ships
    for (const cell of shipCells(ship)) {
      if (isCellInShip(other, cell)) return "OVERLAP";
    }
  }

  // 3. ADJACENT
  if (!ALLOW_ADJACENT_SHIPS) {
    for (const other of others) {
      if (other.type === ship.type) continue;
      for (const cell of shipCells(ship)) {
        if (otherCellsNeighbor8(other, cell)) return "ADJACENT";
      }
    }
  }

  return null;
}

/** Pre-compute each ship's cells once for faster fleet validation. */
type ShipWithCells = ShipPlacement & { cells: Coord[] };

/** True if ship is placed on any coordinate in `target`. */
function isCellInShip(ship: ShipPlacement, target: Coord): boolean {
  for (const cell of shipCells(ship)) {
    if (sameCoord(cell, target)) return true;
  }
  return false;
}

/** True if any cell in ship A is adjacent8 to any cell in ship B (at target). */
function otherCellsNeighbor8(ship: ShipPlacement, target: Coord): boolean {
  for (const nb of neighbors8(target)) {
    if (isCellInShip(ship, nb)) return true;
  }
  return false;
}

/**
 * Whole-fleet validation. Returns the FIRST failure in this precedence:
 *   1. "WRONG_FLEET" — wrong length, missing/duplicated types, or bad orientation
 *   2. per-ship validation (ignoring same-type ships for overlap/adjacent)
 * On success returns { ok: true, value: fleet }.
 */
export function validateFleet(fleet: Fleet): Result<Fleet, PlacementError> {
  // 1. WRONG_FLEET checks
  if (fleet.length !== SHIP_TYPES.length) return { ok: false, error: "WRONG_FLEET" };

  const seen = new Map<ShipType, ShipPlacement>();
  for (const ship of fleet) {
    if (!(ship.type in FLEET_SPEC)) return { ok: false, error: "WRONG_FLEET" };
    if (seen.has(ship.type)) return { ok: false, error: "WRONG_FLEET" };
    if (ship.orientation !== "H" && ship.orientation !== "V")
      return { ok: false, error: "WRONG_FLEET" };
    seen.set(ship.type, ship);
  }

  // 2. Per-ship validation (ignore other ships of the same type)
  for (const ship of fleet) {
    const others = fleet.filter((s) => s.type !== ship.type);
    const err = validateShip(ship, others as Fleet);
    if (err) return { ok: false, error: err };
  }

  return { ok: true, value: fleet };
}
