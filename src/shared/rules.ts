// CONTRACT FILE — owned by the architect. Coders: do NOT edit.
// All game rules live here so the ruleset can be changed in one place.
// Code must read these constants instead of hard-coding 10, 5, etc.

import type { ShipType } from "./types.ts";

export const BOARD_SIZE = 10;

/** Ship lengths. The fleet is exactly one ship of each type. */
export const FLEET_SPEC: Readonly<Record<ShipType, number>> = {
  carrier: 5,
  battleship: 4,
  cruiser: 3,
  submarine: 3,
  destroyer: 2,
};

/** Canonical ship order (UI lists, enemyShipsRemaining, random placement order). */
export const SHIP_TYPES: readonly ShipType[] = [
  "carrier",
  "battleship",
  "cruiser",
  "submarine",
  "destroyer",
];

/**
 * false = ships may not touch each other, not even diagonally
 * (every cell of the 8-neighbourhood around a ship must be free of other ships).
 */
export const ALLOW_ADJACENT_SHIPS = false;

/** true = a player who hits (or sinks) fires again; false = turns always alternate. */
export const EXTRA_SHOT_ON_HIT = false;
