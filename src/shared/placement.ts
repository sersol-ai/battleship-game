import type { Fleet, Rng, ShipPlacement } from "./types.ts";
import { SHIP_TYPES } from "./rules.ts";
import { validateShip } from "./board.ts";
import { pick } from "./rng.ts";

/**
 * Generate a random valid fleet. The RNG drives all picks.
 * Max 100 attempts, then throws Error("randomFleet: no valid layout").
 */
export function randomFleet(rng: Rng): Fleet {
  for (let attempt = 0; attempt < 100; attempt++) {
    const placed: ShipPlacement[] = [];
    for (const type of SHIP_TYPES) {
      const candidates: ShipPlacement[] = [];
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          for (const orientation of ["H", "V"] as const) {
            const ship: ShipPlacement = { type, x, y, orientation };
            if (validateShip(ship, placed) === null) {
              candidates.push(ship);
            }
          }
        }
      }

      if (candidates.length === 0) {
        break;
      }

      const chosen = pick(rng, candidates);
      placed.push(chosen);
    }

    if (placed.length === SHIP_TYPES.length) {
      return placed as Fleet;
    }
  }

  throw new Error("randomFleet: no valid layout");
}
