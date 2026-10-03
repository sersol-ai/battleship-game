import type { AiDifficulty, Coord, GridView, Rng } from "./types.ts";
import { neighbors4, neighbors8 } from "./board.ts";

/** AI with a single method: choose the next shot from what it can see. */
export interface Ai {
  nextShot(grid: GridView): Coord;
}

export function createAi(difficulty: AiDifficulty, rng: Rng): Ai {
  const ai: Ai = {
    nextShot(grid: GridView): Coord {
      if (difficulty === "easy") {
        return nextShotEasy(grid, rng);
      }
      return nextShotNormal(grid, rng);
    },
  };
  return ai;
}

/** Easy: pick any unknown cell */
function nextShotEasy(grid: GridView, rng: Rng): Coord {
  const unknowns = collectUnknowns(grid);
  if (unknowns.length === 0) {
    throw new Error("AI has no valid shot");
  }
  const idx = Math.floor(rng.next() * unknowns.length);
  return unknowns[idx]!;
}

/** Normal: 5-tier targeting */
function nextShotNormal(grid: GridView, rng: Rng): Coord {
  const blocked = collectBlocked(grid);

  // Rule 2: line target — find 3 consecutive hits, return the one before or after
  const line = collectLineTargets(grid, blocked);
  if (line !== null) {
    const pred = line.pred;
    const succ = line.succ;
    if (pred !== null) {
      return pred;
    }
    if (succ !== null) {
      return succ;
    }
    // Line found but both neighbors are blocked/off-board — fall through to Rule 3
  }

  // Rule 3: single target — orthogonal neighbors of each hit
  const single: Coord[] = [];
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      const cell = grid[y]![x]!;
      if (cell === "hit") {
        for (const neighbor of neighbors4({ x, y })) {
          if (
            grid[neighbor.y]![neighbor.x]! === "unknown" &&
            !blocked.has(`${neighbor.x},${neighbor.y}`)
          ) {
            single.push(neighbor);
          }
        }
      }
    }
  }
  if (single.length > 0) {
    const idx = Math.floor(rng.next() * single.length);
    return single[idx]!;
  }

  // Rule 4: hunt — even parity unknowns, then odd parity
  const hunt: Coord[] = [];
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      const cell = grid[y]![x]!;
      if (cell === "unknown" && !blocked.has(`${x},${y}`) && (x + y) % 2 === 0) {
        hunt.push({ x, y });
      }
    }
  }
  if (hunt.length > 0) {
    const idx = Math.floor(rng.next() * hunt.length);
    return hunt[idx]!;
  }

  // Rule 5: fallback — any unknown
  const any = collectUnknowns(grid);
  if (any.length > 0) {
    const idx = Math.floor(rng.next() * any.length);
    return any[idx]!;
  }

  throw new Error("AI has no valid shot");
}

function collectUnknowns(grid: GridView): Coord[] {
  const list: Coord[] = [];
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      if (grid[y]![x]! === "unknown") {
        list.push({ x, y });
      }
    }
  }
  return list;
}

function collectBlocked(grid: GridView): Set<string> {
  // Collect all 8-adjacent cells around sunk ships
  const blocked = new Set<string>();
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      if (grid[y]![x]! === "sunk") {
        for (const neighbor of neighbors8({ x, y })) {
          blocked.add(`${neighbor.x},${neighbor.y}`);
        }
      }
    }
  }
  return blocked;
}

function collectLineTargets(
  grid: GridView,
  blocked: Set<string>,
): {
  pred: Coord | null;
  succ: Coord | null;
} | null {
  // Horizontal triples (only scan up to x = 8, last triple starts at x = 8)
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 9; x++) {
      const left = grid[y]![x]!;
      const mid = grid[y]![x + 1]!;
      const right = grid[y]![x + 2]!;
      if (left === "hit" && mid === "hit" && right === "hit") {
        const pred: Coord | null =
          x - 1 >= 0 && grid[y]![x - 1]! === "unknown" && !blocked.has(`${x - 1},${y}`)
            ? { x: x - 1, y }
            : null;
        const succ: Coord | null =
          x + 3 < 10 && grid[y]![x + 3]! === "unknown" && !blocked.has(`${x + 3},${y}`)
            ? { x: x + 3, y }
            : null;
        return { pred, succ };
      }
    }
  }

  // Vertical triples (only scan up to y = 7, last triple starts at y = 7)
  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 8; y++) {
      const top = grid[y]![x]!;
      const mid = grid[y + 1]![x]!;
      const bottom = grid[y + 2]![x]!;
      if (top === "hit" && mid === "hit" && bottom === "hit") {
        const pred: Coord | null =
          y - 1 >= 0 && grid[y - 1]![x]! === "unknown" && !blocked.has(`${x},${y - 1}`)
            ? { x, y: y - 1 }
            : null;
        const succ: Coord | null =
          y + 3 < 10 && grid[y + 3]![x]! === "unknown" && !blocked.has(`${x},${y + 3}`)
            ? { x, y: y + 3 }
            : null;
        return { pred, succ };
      }
    }
  }

  return null;
}
