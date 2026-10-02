// CONTRACT FILE — owned by the architect. Coders: do NOT edit.
// The battle and placement screens talk ONLY to a GameController. They never
// know whether the opponent is the local AI (LocalController) or a remote
// human over WebSocket (OnlineController).

import type { OpponentStatus, RoomCode } from "../shared/protocol.ts";
import type { Coord, Fleet, PlayerView } from "../shared/types.ts";

export type ConnectionState = "connecting" | "open" | "reconnecting" | "closed";

export interface ControllerSnapshot {
  /** null until the first view is available (online: before "joined"/"state"). */
  readonly view: PlayerView | null;
  readonly mode: "ai" | "online";
  /** LocalController: always "open". */
  readonly connection: ConnectionState;
  /** LocalController: always "connected". */
  readonly opponent: OpponentStatus;
  /** LocalController: always null. */
  readonly room: RoomCode | null;
  /** Last error message to show the user, or null. Cleared on the next successful action. */
  readonly error: string | null;
}

export interface GameController {
  /** Calls listener immediately with the current snapshot, then on every change. Returns unsubscribe. */
  subscribe(listener: (snapshot: ControllerSnapshot) => void): () => void;
  getSnapshot(): ControllerSnapshot;
  place(fleet: Fleet): void;
  fire(coord: Coord): void;
  rematch(): void;
  /** Stop timers, close sockets, drop listeners. Called when leaving the game screens. */
  dispose(): void;
}
