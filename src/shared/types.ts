// CONTRACT FILE — owned by the architect. Coders: do NOT edit.
// If a task seems to need a change here, stop and write it under
// "Questions for architect" in your task file.
//
// Everything in src/shared is pure TypeScript: no DOM, no Node APIs, no I/O,
// no Math.random() (use the Rng from rng.ts). It runs in the browser AND on
// the server.

/** Zero-based cell coordinate. x = column (0..BOARD_SIZE-1, left→right), y = row (top→bottom). */
export interface Coord {
  readonly x: number;
  readonly y: number;
}

/** H = ship extends to the right (+x) from its origin; V = extends down (+y). */
export type Orientation = "H" | "V";

export type ShipType = "carrier" | "battleship" | "cruiser" | "submarine" | "destroyer";

/** One ship on a board. (x, y) is its top-left cell. Length comes from FLEET_SPEC[type]. */
export interface ShipPlacement {
  readonly type: ShipType;
  readonly x: number;
  readonly y: number;
  readonly orientation: Orientation;
}

/** A complete fleet: exactly one ShipPlacement per ShipType (order irrelevant). */
export type Fleet = readonly ShipPlacement[];

export type ShotOutcome = "miss" | "hit" | "sunk";

export interface ShotResult {
  readonly coord: Coord;
  readonly outcome: ShotOutcome;
  /** Present only when outcome === "sunk": the ship that was just sunk. */
  readonly sunkShip?: ShipPlacement;
}

/** One player's board: their own fleet plus every shot the OPPONENT has fired at it, in order. */
export interface Board {
  readonly fleet: Fleet;
  readonly shotsReceived: readonly Coord[];
}

/**
 * What a single cell looks like to a given viewer.
 * - "unknown": enemy cell not shot yet (never used on your own grid)
 * - "empty":   own cell with no ship and not shot
 * - "ship":    own intact ship cell (never shown on enemy grid, except after game over reveal)
 * - "miss":    shot, no ship
 * - "hit":     shot, ship there, ship not yet sunk
 * - "sunk":    ship cell belonging to a fully sunk ship
 */
export type CellView = "unknown" | "empty" | "ship" | "miss" | "hit" | "sunk";

/** Grid of CellView indexed as grid[y][x]. Always BOARD_SIZE x BOARD_SIZE. */
export type GridView = readonly (readonly CellView[])[];

export type PlayerId = "p1" | "p2";

export type Phase = "placing" | "playing" | "finished";

export interface MatchState {
  readonly phase: Phase;
  /** null until that player's fleet has been accepted. */
  readonly boards: Readonly<Record<PlayerId, Board | null>>;
  /** Whose turn it is. Meaningful only in phase "playing". */
  readonly turn: PlayerId;
  readonly winner: PlayerId | null;
  /** Every accepted shot in order. */
  readonly history: readonly { readonly by: PlayerId; readonly result: ShotResult }[];
}

export type MatchAction =
  | { readonly type: "place"; readonly player: PlayerId; readonly fleet: Fleet }
  | { readonly type: "fire"; readonly player: PlayerId; readonly coord: Coord };

export type PlacementError = "WRONG_FLEET" | "OUT_OF_BOUNDS" | "OVERLAP" | "ADJACENT";

export type ShotError = "OUT_OF_BOUNDS" | "ALREADY_SHOT";

export type MatchError =
  "NOT_PLACING" | "ALREADY_PLACED" | "INVALID_FLEET" | "NOT_PLAYING" | "NOT_YOUR_TURN" | ShotError;

export type Result<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

/**
 * Everything ONE player is allowed to see. Built by toPlayerView() in view.ts.
 * This is the only game data ever sent over the network — it must never leak
 * the opponent's unsunk ship positions before the match is finished.
 */
export interface PlayerView {
  readonly me: PlayerId;
  readonly phase: Phase;
  readonly isMyTurn: boolean; // false unless phase === "playing" and turn === me
  readonly winner: PlayerId | null;
  readonly myPlaced: boolean;
  readonly enemyPlaced: boolean;
  readonly myGrid: GridView; // all-"empty" grid if I have not placed yet
  readonly enemyGrid: GridView; // "unknown"/"miss"/"hit"/"sunk"; after finish, unsunk enemy ships show as "ship"
  /** Enemy ship types not yet sunk, in SHIP_TYPES order. */
  readonly enemyShipsRemaining: readonly ShipType[];
  /** Own ship types not yet sunk, in SHIP_TYPES order. */
  readonly myShipsRemaining: readonly ShipType[];
  /** The most recent shot by either player, or null. */
  readonly lastShot: { readonly by: PlayerId; readonly result: ShotResult } | null;
}

/** Deterministic random source. next() returns a float in [0, 1). */
export interface Rng {
  next(): number;
}

export type AiDifficulty = "easy" | "normal";
