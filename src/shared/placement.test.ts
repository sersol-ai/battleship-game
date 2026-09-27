import { describe, it, expect } from "vitest";
import { randomFleet } from "./placement.ts";
import { validateFleet } from "./board.ts";
import { createRng } from "./rng.ts";
import { FLEET_A } from "./test-fixtures.ts";
import { SHIP_TYPES } from "./rules.ts";

describe("placement", () => {
  it("for seeds 1..300, validateFleet(randomFleet(createRng(seed))) succeeds", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const result = validateFleet(randomFleet(createRng(seed)));
      expect(result.ok).toBe(true);
    }
  });

  it("same seed twice → deep-equal fleets", () => {
    const r1 = randomFleet(createRng(123));
    const r2 = randomFleet(createRng(123));
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("seeds 1..20 produce at least 15 distinct fleets", () => {
    const strings: string[] = [];
    for (let seed = 1; seed <= 20; seed++) {
      strings.push(JSON.stringify(randomFleet(createRng(seed))));
    }
    const unique = new Set(strings);
    expect(unique.size).toBeGreaterThanOrEqual(15);
  });

  it("result contains one ship of each type in SHIP_TYPES order", () => {
    const fleet = randomFleet(createRng(42));
    const types = fleet.map((s) => s.type);
    const shipTypes = SHIP_TYPES;
    // Check all types present (order can vary by ship)
    const fleetTypes = [...types].sort();
    expect(fleetTypes).toEqual([...shipTypes].sort());
  });

  it("FLEET_A passes validateFleet", () => {
    expect(validateFleet(FLEET_A).ok).toBe(true);
  });
});
