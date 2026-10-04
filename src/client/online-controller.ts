// GameController over the wire: the browser side of an online match. It owns the
// WsClient, keeps the seat token (memory + sessionStorage) so a dropped socket can
// resume, and turns server messages into ControllerSnapshots.

import type {
  ClientMessage,
  OpponentStatus,
  ProtocolError,
  RoomCode,
  ServerMessage,
} from "../shared/protocol.ts";
import type { Coord, Fleet, PlayerView } from "../shared/types.ts";
import type { ConnectionState, ControllerSnapshot, GameController } from "./controller.ts";
import { createWsClient } from "./ws-client.ts";
import type { WsLike } from "./ws-client.ts";
import { errorText } from "./error-text.ts";

export type OnlineIntent = { kind: "create" } | { kind: "join"; room: RoomCode };

export interface OnlineControllerOptions {
  intent: OnlineIntent;
  url?: string; // default `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`
  createSocket?: (url: string) => WsLike;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null; // default: sessionStorage (null if it throws)
}

const SESSION_KEY = "battleship.session";

function browserStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}

export function createOnlineController(opts: OnlineControllerOptions): GameController {
  const intent = opts.intent;
  const url = opts.url ?? `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
  const storage = opts.storage === undefined ? browserStorage() : opts.storage;

  let view: PlayerView | null = null;
  let connection: ConnectionState = "connecting";
  let opponent: OpponentStatus = "waiting";
  let room: RoomCode | null = null;
  let error: string | null = null;
  const listeners = new Set<(snapshot: ControllerSnapshot) => void>();

  let memory: { room: RoomCode; token: string } | null = null;
  let resuming = false;
  let resumedFromStorage = false;

  function snapshot(): ControllerSnapshot {
    return { view, mode: "online", connection, opponent, room, error };
  }

  function notify(): void {
    const current = snapshot();
    for (const listener of listeners) listener(current);
  }

  function storedSession(): { room: RoomCode; token: string } | null {
    if (storage === null) return null;
    const raw = storage.getItem(SESSION_KEY);
    if (raw === null) return null;
    let parsed: { room: unknown; token: unknown } | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    if (parsed === null) return null;
    if (typeof parsed.room !== "string" || typeof parsed.token !== "string") return null;
    return { room: parsed.room, token: parsed.token };
  }

  function storeSession(): void {
    if (storage === null || memory === null) return;
    storage.setItem(SESSION_KEY, JSON.stringify({ room: memory.room, token: memory.token }));
  }

  function clearStoredSession(): void {
    if (storage === null) return;
    storage.removeItem(SESSION_KEY);
  }

  const client = createWsClient({
    url,
    onOpen: () => {
      if (memory !== null) {
        resuming = true;
        client.send({ t: "resume", room: memory.room, token: memory.token });
        return;
      }
      const stored = storedSession();
      if (intent.kind === "join" && stored !== null && stored.room === intent.room) {
        resuming = true;
        resumedFromStorage = true;
        client.send({ t: "resume", room: stored.room, token: stored.token });
        return;
      }
      resuming = false;
      if (intent.kind === "create") {
        client.send({ t: "create" });
      } else {
        client.send({ t: "join", room: intent.room });
      }
    },
    onMessage: (msg: ServerMessage) => {
      switch (msg.t) {
        case "joined": {
          memory = { room: msg.room, token: msg.token };
          room = msg.room;
          storeSession();
          notify();
          return;
        }
        case "state": {
          view = msg.view;
          error = null;
          notify();
          return;
        }
        case "opponent": {
          opponent = msg.status;
          notify();
          return;
        }
        case "error": {
          error = errorText(msg.code);
          if (resuming && (msg.code === "BAD_TOKEN" || msg.code === "ROOM_NOT_FOUND")) {
            clearStoredSession();
            memory = null;
            resuming = false;
            if (resumedFromStorage && intent.kind === "join") {
              resumedFromStorage = false;
              client.send({ t: "join", room: intent.room });
            }
          }
          notify();
          return;
        }
      }
    },
    onState: (state: ConnectionState) => {
      connection = state;
      notify();
    },
    createSocket: opts.createSocket,
  });

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      listener(snapshot());
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot(),
    place: (fleet) => {
      client.send({ t: "place", fleet });
    },
    fire: (coord) => {
      client.send({ t: "fire", coord });
    },
    rematch: () => {
      client.send({ t: "rematch" });
    },
    dispose: () => {
      client.send({ t: "leave" });
      clearStoredSession();
      client.close();
      listeners.clear();
    },
  };
}
