import { describe, expect, it } from "vitest";
import { BOARD_SIZE, FLEET_SPEC, SHIP_TYPES } from "./rules.ts";

describe("rules", () => {
  it("SHIP_TYPES lists every FLEET_SPEC key exactly once", () => {
    expect([...SHIP_TYPES].sort()).toEqual(Object.keys(FLEET_SPEC).sort());
  });

  it("every ship fits on the board", () => {
    for (const type of SHIP_TYPES) expect(FLEET_SPEC[type]).toBeLessThanOrEqual(BOARD_SIZE);
  });
});
