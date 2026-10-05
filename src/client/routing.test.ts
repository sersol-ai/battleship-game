import { describe, it, expect } from "vitest";
import type { PlayerView } from "../shared/types.ts";
import { routeFor, type Route } from "./routing.ts";

/** Build a minimal PlayerView with only the fields routeFor needs. */
const pv = (phase: string, myPlaced = true): any =>
  ({
    phase,
    myPlaced,
  }) as Partial<PlayerView> & { phase: string };

describe("routing", () => {
  it("rule 1: online mode, no view → lobby", () => {
    expect(
      routeFor({
        mode: "online",
        view: null,
        connection: "open",
        opponent: "waiting" as never,
        room: "ABC" as never,
        error: null,
      }),
    ).toBe("lobby");
  });

  it("rule 2: online placing, player not placed, opponent waiting → lobby", () => {
    expect(
      routeFor({
        mode: "online",
        view: pv("placing", false),
        connection: "open",
        opponent: "waiting",
        room: "ABC" as never,
        error: null,
      }),
    ).toBe("lobby");
  });

  it("rule 2: online placing, player not placed, opponent left → lobby", () => {
    expect(
      routeFor({
        mode: "online",
        view: pv("placing", false),
        connection: "open",
        opponent: "left",
        room: "ABC" as never,
        error: null,
      }),
    ).toBe("lobby");
  });

  it("rule 3: online placing, player already placed → placement (shows placement-waiting)", () => {
    const v = pv("placing", true);
    expect(
      routeFor({
        mode: "online",
        view: v,
        connection: "open",
        opponent: "waiting",
        room: "ABC" as never,
        error: null,
      }),
    ).toBe("placement");
  });

  it("rule 2: online placing, already placed, opponent left → lobby", () => {
    expect(
      routeFor({
        mode: "online",
        view: pv("placing", true),
        connection: "open",
        opponent: "left",
        room: "ABCDEF",
        error: null,
      }),
    ).toBe("lobby");
  });

  it("rule 3: online placing, already placed, opponent connected → placement", () => {
    expect(
      routeFor({
        mode: "online",
        view: pv("placing", true),
        connection: "open",
        opponent: "connected",
        room: "ABCDEF",
        error: null,
      }),
    ).toBe("placement");
  });

  it("online playing (already placed) still routes to battle", () => {
    expect(
      routeFor({
        mode: "online",
        view: pv("playing"),
        connection: "open",
        opponent: "connected",
        room: "ABCDEF",
        error: null,
      }),
    ).toBe("battle");
  });

  it("rule 3: AI game, phase placing → placement", () => {
    expect(
      routeFor({
        mode: "ai",
        view: pv("placing"),
        connection: "open",
        opponent: "connected" as never,
        room: null,
        error: null,
      }),
    ).toBe("placement");
  });

  it("rule 4: AI game, phase playing → battle", () => {
    expect(
      routeFor({
        mode: "ai",
        view: pv("playing"),
        connection: "open",
        opponent: "connected" as never,
        room: null,
        error: null,
      }),
    ).toBe("battle");
  });

  it("rule 4: AI game, null view → placement (never happens, but handle it)", () => {
    expect(
      routeFor({
        mode: "ai",
        view: null,
        connection: "open",
        opponent: "connected" as never,
        room: null,
        error: null,
      }),
    ).toBe("placement");
  });
});
