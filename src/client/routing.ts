import type { ControllerSnapshot } from "./controller.ts";

export type Route = "lobby" | "placement" | "battle";

export function routeFor(s: ControllerSnapshot): Route {
  const { mode, view } = s;

  // Rule 1: online, no view → lobby
  if (mode === "online" && view === null) {
    return "lobby";
  }

  // Rule 2: online placing, opponent left (or still waiting and not placed yet) → lobby
  if (
    mode === "online" &&
    view !== null &&
    typeof view === "object" &&
    "phase" in view &&
    view.phase === "placing" &&
    (s.opponent === "left" || (s.opponent === "waiting" && !view.myPlaced))
  ) {
    return "lobby";
  }

  // Rule 3: placing phase → placement. Online stays here after Ready too: the placement
  // screen shows `placement-waiting` until the match moves to "playing" (rule below).
  if (view !== null && typeof view === "object" && "phase" in view && view.phase === "placing") {
    return "placement";
  }

  // Rule 4: ai mode, null view → placement (fallback, never happens in practice)
  if (mode === "ai" && view === null) {
    return "placement";
  }

  return "battle";
}
