// CONTRACT FILE — owned by the architect. Coders: do NOT edit.
// WebSocket protocol between browser and server. Every frame is one JSON
// object with a string discriminator field "t". Endpoint: ws(s)://<host>/ws
//
// Design rule: the server is authoritative and sends the FULL PlayerView
// ("state") after every change. Clients never patch state incrementally —
// they just re-render from the latest view.

import type { Coord, Fleet, MatchError, PlayerId, PlayerView } from "./types.ts";

/** 6 chars from ROOM_CODE_ALPHABET, e.g. "K7PQ2M". Case-insensitive on input; always upper-case on the wire. */
export type RoomCode = string;
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

/** Max accepted frame size in bytes (server rejects larger frames). */
export const MAX_MESSAGE_BYTES = 16 * 1024;
/** A disconnected player keeps their seat this long and may "resume". */
export const RECONNECT_GRACE_MS = 60_000;
/** A room with no connected players is deleted after this long. */
export const EMPTY_ROOM_TTL_MS = 5 * 60_000;

// ---------- client → server ----------

export type ClientMessage =
  /** Create a new room; sender becomes p1. */
  | { readonly t: "create" }
  /** Join an existing room as p2. */
  | { readonly t: "join"; readonly room: RoomCode }
  /** Re-attach to a seat after a disconnect (token from the earlier "joined"). */
  | { readonly t: "resume"; readonly room: RoomCode; readonly token: string }
  | { readonly t: "place"; readonly fleet: Fleet }
  | { readonly t: "fire"; readonly coord: Coord }
  /** Ask for a new match in the same room. Starts when BOTH players have sent it after a finished match. */
  | { readonly t: "rematch" }
  /** Leave the room for good (seat is freed immediately, opponent gets status "left"). */
  | { readonly t: "leave" };

// ---------- server → client ----------

export type OpponentStatus = "waiting" | "connected" | "disconnected" | "left";

export type ProtocolError =
  | "BAD_MESSAGE" // not JSON / fails isClientMessage() / too large
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "BAD_TOKEN"
  | "NOT_IN_ROOM" // place/fire/rematch/leave before create/join/resume
  | "ALREADY_IN_ROOM" // create/join/resume on a socket that already has a seat
  | "SERVER_BUSY" // room limit reached
  | MatchError;

export type ServerMessage =
  /** Sent once after a successful create/join/resume. Client stores token for resume. */
  | {
      readonly t: "joined";
      readonly room: RoomCode;
      readonly me: PlayerId;
      readonly token: string;
    }
  /** Full game view for this player. Sent after joined and after EVERY state change. */
  | { readonly t: "state"; readonly view: PlayerView }
  /** Sent after joined and whenever the opponent's connection status changes. */
  | { readonly t: "opponent"; readonly status: OpponentStatus }
  /** Reply to a rejected client message. The connection stays open. */
  | { readonly t: "error"; readonly code: ProtocolError; readonly message: string };
