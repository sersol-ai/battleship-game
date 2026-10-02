import type { ControllerSnapshot } from "./controller.ts";

export type Route = "lobby" | "placement" | "battle";

export function routeFor(s: ControllerSnapshot): Route {
  const { mode, view } = s;

  // Rule 1: online, no view → lobby
  if (mode === "online" && view === null) {
    return "lobby";
  }

  // Rule 2: online placing, not placed, opponent waiting/left → lobby
  if (
    mode === "online" &&
    view !== null &&
    typeof view === "object" &&
    "phase" in view &&
    view.phase === "placing" &&
    !view.myPlaced &&
    (s.opponent === "waiting" || s.opponent === "left")
  ) {
    return "lobby";
  }

  // Rule 3: placing phase → placement (not online with myPlaced=true)
  if (
    view !== null &&
    typeof view === "object" &&
    "phase" in view &&
    view.phase === "placing" &&
    !(mode === "online" && view.myPlaced)
  ) {
    return "placement";
  }

  // Rule 4: ai mode, null view → placement (fallback, never happens in practice)
  if (mode === "ai" && view === null) {
    return "placement";
  }

  return "battle";
}
