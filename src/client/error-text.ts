import type { ProtocolError } from "../shared/protocol.ts";

/** Short English sentence for every ProtocolError code. */
const ERROR_TEXTS: Record<ProtocolError, string> = {
  BAD_MESSAGE: "Bad request from server",
  ROOM_NOT_FOUND: "Room not found",
  ROOM_FULL: "Room is full",
  BAD_TOKEN: "Invalid token",
  NOT_IN_ROOM: "Not in a room",
  ALREADY_IN_ROOM: "Already in a room",
  SERVER_BUSY: "Server is busy",
  NOT_PLACING: "Not currently placing",
  ALREADY_PLACED: "You have already placed your fleet",
  INVALID_FLEET: "Invalid fleet composition",
  NOT_PLAYING: "Match is not in progress",
  NOT_YOUR_TURN: "Not your turn",
  OUT_OF_BOUNDS: "Shot is outside the grid",
  ALREADY_SHOT: "Cell was already shot at",
};

export function errorText(code: ProtocolError): string {
  return ERROR_TEXTS[code];
}
