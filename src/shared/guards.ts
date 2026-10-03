import type { ClientMessage } from "./protocol.ts";
import type { Coord, Fleet, Orientation, ShipPlacement, ShipType } from "./types.ts";
import { MAX_MESSAGE_BYTES, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "./protocol.ts";
import { SHIP_TYPES } from "./rules.ts";

/**
 * Runtime validation of untrusted JSON coming off the wire. Nothing here throws:
 * every entry point returns null (or false) for anything it does not recognise.
 * `parseClientMessage` also strips unknown fields — the object it returns is always
 * freshly built, so garbage can never reach the engine or the room manager.
 */

const SHIP_TYPE_NAMES: readonly string[] = SHIP_TYPES;

function isShipType(x: unknown): x is ShipType {
  return typeof x === "string" && SHIP_TYPE_NAMES.includes(x);
}

function isOrientation(x: unknown): x is Orientation {
  return typeof x === "string" && (x === "H" || x === "V");
}

/** true only for a real JS integer (rejects NaN, Infinity, 1.5, "1"). */
function isIntegerValue(x: unknown): x is number {
  return typeof x === "number" && Number.isInteger(x);
}

/** Non-null, non-array object as a string-keyed record, or null. */
function plainObject(x: unknown): Record<string, unknown> | null {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return null;
  return x as Record<string, unknown>;
}

export function isRoomCode(x: unknown): x is string {
  if (typeof x !== "string" || x.length !== ROOM_CODE_LENGTH) return false;
  for (const char of x) {
    if (!ROOM_CODE_ALPHABET.includes(char)) return false;
  }
  return true;
}

/** Object with integer x and y. Bounds are the engine's job, not the guard's. */
export function isCoord(x: unknown): boolean {
  return toCoord(x) !== null;
}

function toCoord(x: unknown): Coord | null {
  const obj = plainObject(x);
  if (obj === null) return null;
  const cx = obj.x;
  const cy = obj.y;
  if (!isIntegerValue(cx) || !isIntegerValue(cy)) return null;
  return { x: cx, y: cy };
}

/** Array of 1..10 ship objects; each keeps only type / x / y / orientation. */
function toFleet(x: unknown): Fleet | null {
  if (!Array.isArray(x) || x.length < 1 || x.length > 10) return null;
  const fleet: ShipPlacement[] = [];
  for (const item of x) {
    const obj = plainObject(item);
    if (obj === null) return null;
    const type = obj.type;
    const orientation = obj.orientation;
    const cx = obj.x;
    const cy = obj.y;
    if (
      !isShipType(type) ||
      !isOrientation(orientation) ||
      !isIntegerValue(cx) ||
      !isIntegerValue(cy)
    ) {
      return null;
    }
    fleet.push({ type, x: cx, y: cy, orientation });
  }
  return fleet;
}

/**
 * Validate and rebuild a message: the result is a NEW object holding only the
 * fields the protocol knows about (nested coord / fleet items are rebuilt too).
 */
function buildClientMessage(x: unknown): ClientMessage | null {
  const obj = plainObject(x);
  if (obj === null) return null;
  const t = obj.t;
  if (typeof t !== "string") return null;
  switch (t) {
    case "create":
      return { t: "create" };
    case "join": {
      const room = obj.room;
      if (!isRoomCode(room)) return null;
      return { t: "join", room };
    }
    case "resume": {
      const room = obj.room;
      const token = obj.token;
      if (!isRoomCode(room)) return null;
      if (typeof token !== "string" || token.length < 1 || token.length > 64) return null;
      return { t: "resume", room, token };
    }
    case "place": {
      const fleet = toFleet(obj.fleet);
      if (fleet === null) return null;
      return { t: "place", fleet };
    }
    case "fire": {
      const coord = toCoord(obj.coord);
      if (coord === null) return null;
      return { t: "fire", coord };
    }
    case "rematch":
      return { t: "rematch" };
    case "leave":
      return { t: "leave" };
    default:
      return null;
  }
}

export function isClientMessage(x: unknown): x is ClientMessage {
  return buildClientMessage(x) !== null;
}

/**
 * raw.length > MAX_MESSAGE_BYTES → null. JSON.parse failure → null.
 * Valid message → a NEW object containing only the known fields, else null.
 */
export function parseClientMessage(raw: string): ClientMessage | null {
  if (raw.length > MAX_MESSAGE_BYTES) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return buildClientMessage(parsed);
}
