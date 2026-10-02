import type { Fleet } from "./types.ts";

/** All horizontal, left edge, rows 0/2/4/6/8. */
export const FLEET_A: Fleet = [
  { type: "carrier", x: 0, y: 0, orientation: "H" },
  { type: "battleship", x: 0, y: 2, orientation: "H" },
  { type: "cruiser", x: 0, y: 4, orientation: "H" },
  { type: "submarine", x: 0, y: 6, orientation: "H" },
  { type: "destroyer", x: 0, y: 8, orientation: "H" },
];

/** All vertical, top edge, columns 0/2/4/6/8. */
export const FLEET_B: Fleet = [
  { type: "carrier", x: 0, y: 0, orientation: "V" },
  { type: "battleship", x: 2, y: 0, orientation: "V" },
  { type: "cruiser", x: 4, y: 0, orientation: "V" },
  { type: "submarine", x: 6, y: 0, orientation: "V" },
  { type: "destroyer", x: 8, y: 0, orientation: "V" },
];
