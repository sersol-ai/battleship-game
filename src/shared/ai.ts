import type { AiDifficulty, CellView, Coord, GridView, Rng } from "./types.ts";
import { ALLOW_ADJACENT_SHIPS, BOARD_SIZE } from "./rules.ts";
import { neighbors4, neighbors8 } from "./board.ts";

/* ───────── helpers ───────── */

function pick<T>(rng: Rng, list: T[]): T {
  if (list.length === 0) throw new Error("empty list");
  return list[Math.floor(rng.next() * list.length)]!;
}

/** Collect coords where `grid[y][x] === "unknown"`. */
function unknownCells(grid: GridView): Coord[] {
  const out: Coord[] = [];
  for (let y = 0; y < grid.length; y++) {
    if (!grid[y]) continue;
    for (let x = 0; x < grid[y]!.length; x++) {
      if (grid[y][x] === "unknown") out.push({ x, y } as Coord);
    }
  }
  return out;
}

/** Collect coords where `grid[y][x] === "hit"`. */
function hitCells(grid: GridView): Coord[] {
  const out: Coord[] = [];
  for (let y = 0; y < grid.length; y++) {
    if (!grid[y]) continue;
    for (let x = 0; x < grid[y]!.length; x++) {
      if (grid[y][x] === "hit") out.push({ x, y } as Coord);
    }
  }
  return out;
}

/** Blockset: 8-neighbourhood of every sunk cell. */
function blockedSet(grid: GridView): Set<string> {
  if (ALLOW_ADJACENT_SHIPS) return new Set<string>();
  const b = new Set<string>();
  for (let y = 0; y < grid.length; y++) {
    if (!grid[y]) continue;
    for (let x = 0; x < grid[y]!.length; x++) {
      if (grid[y][x] === "sunk") {
        for (const nb of neighbors8({ x, y }) as Coord[]) b.add(`${nb.x},${nb.y}`);
      }
    }
  }
  return b;
}

/** Return coord if in-bounds. */
function inBounds(c: Coord): boolean {
  return c.x >= 0 && c.x < BOARD_SIZE && c.y >= 0 && c.y < BOARD_SIZE;
}

/* ───────── normal line-target ───────── */

function runCells(grid: GridView, hits: Coord[], axis: "x" | "y"): Coord[] {
  if (axis === "x") {
    const sorted = hits.sort((a, b) => a.x - b.x);
    const runs = [];
    let cur: Coord[] = [];
    for (const h of sorted) {
      if (!cur.length) {
        cur = [h];
      } else if (h.x === cur[0]!.x + 1) {
        cur.push(h);
      } else {
        if (cur.length > 1) runs.push([...cur]);
        cur = [h];
      }
    }
    if (cur.length > 1) runs.push(cur);
    return runs.flat();
  }
  const sorted = hits.sort((a, b) => a.y - b.y);
  const runs = [];
  let cur: Coord[] = [];
  for (const h of sorted) {
    if (!cur.length) {
      cur = [h];
    } else if (h.y === cur[0]!.y + 1) {
      cur.push(h);
    } else {
      if (cur.length > 1) runs.push([...cur]);
      cur = [h];
    }
  }
  if (cur.length > 1) runs.push(cur);
  return runs.flat();
}

function lineCandidates(grid: GridView, blocker: Set<string>): Coord[] {
  const hits = hitCells(grid);
  const out: Coord[] = [];
  for (const [a, b] of hits.flatMap((h) => hits.map((other) => [h, other]!).slice(1))) {
    const dx = a!.x - b!.x,
      dy = a!.y - b!.y;
    if ((Math.abs(dx) === 1 && dy === 0) || (Math.abs(dy) === 1 && dx === 0)) {
      const axis = Math.abs(dx) === 1 ? "x" : "y";
      const sorted = hits.sort((u, v) => (axis === "x" ? u!.x - v!.x : u!.y - v!.y));
      const start = sorted[0];
      const end = sorted[sorted.length - 1];
      const pred =
        axis === "x" ? { x: start!.x - 1, y: start!.y } : { x: start!.x, y: start!.y - 1 };
      const succ = axis === "x" ? { x: end.x + 1, y: end.y } : { x: end.x, y: end.y + 1 };
      if (
        inBounds(pred) &&
        grid[pred.y] !== undefined &&
        grid[pred.y]![pred.x] === "unknown" &&
        !blocker.has(`${pred.x},${pred.y}`)
      ) {
        out.push(pred);
      }
      if (
        inBounds(succ) &&
        grid[succ.y] !== undefined &&
        grid[succ.y]![succ.x] === "unknown" &&
        !blocker.has(`${succ.x},${succ.y}`)
      ) {
        out.push(succ);
      }
    }
  }
  return out;
}

function singleCandidates(grid: GridView, blocker: Set<string>): Coord[] {
  const out: Coord[] = [];
  for (let y = 0; y < grid.length; y++) {
    if (!grid[y]) continue;
    for (let x = 0; x < grid[y]!.length; x++) {
      if (grid[y][x] === "hit") {
        for (const nb of neighbors4({ x, y }) as Coord[]) {
          if (
            grid[nb.y] !== undefined &&
            grid[nb.y][nb.x] === "unknown" &&
            !blocker.has(`${nb.x},${nb.y}`)
          ) {
            out.push(nb);
          }
        }
      }
    }
  }
  return out;
}

function huntCandidates(grid: GridView, blocker: Set<string>): Coord[] {
  const out1: Coord[] = [];
  const out2: Coord[] = [];
  for (let y = 0; y < grid.length; y++) {
    if (!grid[y]) continue;
    for (let x = 0; x < grid[y]!.length; x++) {
      if (grid[y][x] === "unknown" && !blocker.has(`${x},${y}`)) {
        if ((x + y) % 2 === 0) out1.push({ x, y } as Coord);
        else out2.push({ x, y } as Coord);
      }
    }
  }
  return out1.length > 0 ? out1 : out2;
}

function fallbackCandidates(grid: GridView, blocker: Set<string>): Coord[] {
  return unknownCells(grid).filter((c) => !blocker.has(`${c.x},${c.y}`));
}

/* ───────── factory ───────── */

export interface Ai {
  difficulty: AiDifficulty;
  rng: Rng;
  nextShot: (grid: GridView) => Coord;
}

export function createAi(difficulty: AiDifficulty, rng: Rng): Ai {
  if (difficulty === "easy") {
    return {
      difficulty,
      rng,
      nextShot(grid) {
        return pick(rng, unknownCells(grid));
      },
    };
  }
  return {
    difficulty,
    rng,
    nextShot(grid) {
      const blocker = blockedSet(grid);
      for (const c of lineCandidates(grid, blocker)) return c;
      for (const c of singleCandidates(grid, blocker)) return c;
      for (const c of huntCandidates(grid, blocker)) return c;
      return pick(rng, fallbackCandidates(grid, blocker));
    },
  };
}
