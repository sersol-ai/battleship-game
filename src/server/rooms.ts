// T-15 — RoomManager: every multiplayer rule (rooms, seats, reconnects, rematches).
// No sockets, no JSON, no HTTP — the server (T-16) injects send/now/rng/newToken, so all of
// this stays pure and unit-testable. Messages arriving here are already validated by guards.

import type {
  ClientMessage,
  OpponentStatus,
  ProtocolError,
  RoomCode,
  ServerMessage,
} from "../shared/protocol.ts";
import type { Coord, Fleet, MatchAction, MatchState, PlayerId, Rng } from "../shared/types.ts";
import {
  EMPTY_ROOM_TTL_MS,
  RECONNECT_GRACE_MS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from "../shared/protocol.ts";
import { applyAction, createMatch, other } from "../shared/match.ts";
import { toPlayerView } from "../shared/view.ts";
import { pick } from "../shared/rng.ts";

/** Room cap. protocol.ts has no MAX_ROOMS, so the manager owns the default (spec: 500). */
const DEFAULT_MAX_ROOMS = 500;

const ERROR_TEXT: Record<ProtocolError, string> = {
  BAD_MESSAGE: "That message is not allowed.",
  ROOM_NOT_FOUND: "That room does not exist.",
  ROOM_FULL: "That room already has two players.",
  BAD_TOKEN: "That seat token is not valid for this room.",
  NOT_IN_ROOM: "You are not in a room yet.",
  ALREADY_IN_ROOM: "This connection already has a seat.",
  SERVER_BUSY: "The server is full, please try again later.",
  NOT_PLACING: "The match is not in the placing phase.",
  ALREADY_PLACED: "You have already placed your fleet.",
  INVALID_FLEET: "That fleet is not valid.",
  NOT_PLAYING: "The match is not in the playing phase.",
  NOT_YOUR_TURN: "It is not your turn.",
  OUT_OF_BOUNDS: "That shot is outside the board.",
  ALREADY_SHOT: "You already fired at that cell.",
};

export type ConnId = string;

interface Seat {
  token: string;
  conn: ConnId | null;
  disconnectedAt: number | null;
}

interface Room {
  code: string;
  match: MatchState;
  seats: Record<PlayerId, Seat | null>;
  rematch: Set<PlayerId>;
  lastWinner: PlayerId | null;
}

export interface RoomManagerDeps {
  send(conn: ConnId, msg: ServerMessage): void;
  now(): number;
  rng: Rng;
  newToken(): string;
  maxRooms?: number; // default 500
  log?(event: string, data: Record<string, unknown>): void; // default no-op
}

export interface RoomManager {
  handleMessage(conn: ConnId, msg: ClientMessage): void; // msg already validated by guards
  handleDisconnect(conn: ConnId): void;
  sweep(): void; // called every 10 s by the server
  roomCount(): number;
}

export function createRoomManager(deps: RoomManagerDeps): RoomManager {
  const send = deps.send;
  const now = deps.now;
  const rng = deps.rng;
  const newToken = deps.newToken;
  const maxRooms = deps.maxRooms ?? DEFAULT_MAX_ROOMS;
  const log = deps.log ?? ((_event: string, _data: Record<string, unknown>) => {});

  const rooms = new Map<RoomCode, Room>();
  const conns = new Map<ConnId, { code: RoomCode; player: PlayerId }>();

  function err(conn: ConnId, code: ProtocolError): void {
    send(conn, { t: "error", code, message: ERROR_TEXT[code] });
  }

  function sendState(room: Room, p: PlayerId): void {
    const seat = room.seats[p];
    if (seat !== null && seat.conn !== null) {
      send(seat.conn, { t: "state", view: toPlayerView(room.match, p) });
    }
  }

  function broadcastState(room: Room): void {
    sendState(room, "p1");
    sendState(room, "p2");
  }

  function opponentStatus(room: Room, p: PlayerId): OpponentStatus {
    const otherSeat = room.seats[other(p)];
    if (otherSeat === null) return "waiting";
    return otherSeat.conn === null ? "disconnected" : "connected";
  }

  function newMatch(): MatchState {
    return createMatch(rng.next() < 0.5 ? "p1" : "p2");
  }

  function freshRoomCode(): RoomCode {
    let code = "";
    do {
      code = "";
      for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
        code += pick(rng, [...ROOM_CODE_ALPHABET]);
      }
    } while (rooms.has(code));
    return code;
  }

  function freeSeat(room: Room, p: PlayerId): void {
    const seat = room.seats[p];
    if (seat !== null && seat.conn !== null) {
      conns.delete(seat.conn);
    }
    room.seats[p] = null;
    room.match = newMatch();
    room.rematch.clear();
    if (room.seats.p1 === null && room.seats.p2 === null) {
      log("room_closed", { code: room.code });
      rooms.delete(room.code);
      return;
    }
    const otherSeat = room.seats[other(p)];
    if (otherSeat !== null && otherSeat.conn !== null) {
      send(otherSeat.conn, { t: "opponent", status: "left" });
    }
    broadcastState(room);
  }

  function handleCreate(conn: ConnId): void {
    if (conns.has(conn)) {
      err(conn, "ALREADY_IN_ROOM");
      return;
    }
    if (rooms.size >= maxRooms) {
      err(conn, "SERVER_BUSY");
      return;
    }
    const code = freshRoomCode();
    const token = newToken();
    const room: Room = {
      code,
      match: newMatch(),
      seats: { p1: { token, conn, disconnectedAt: null }, p2: null },
      rematch: new Set<PlayerId>(),
      lastWinner: null,
    };
    rooms.set(code, room);
    conns.set(conn, { code, player: "p1" });
    send(conn, { t: "joined", room: code, me: "p1", token });
    sendState(room, "p1");
    send(conn, { t: "opponent", status: "waiting" });
    log("room_created", { code });
  }

  function handleJoin(conn: ConnId, code: RoomCode): void {
    if (conns.has(conn)) {
      err(conn, "ALREADY_IN_ROOM");
      return;
    }
    const room = rooms.get(code);
    if (room === undefined) {
      err(conn, "ROOM_NOT_FOUND");
      return;
    }
    let seatPlayer: PlayerId | null = null;
    if (room.seats.p1 === null) seatPlayer = "p1";
    else if (room.seats.p2 === null) seatPlayer = "p2";
    if (seatPlayer === null) {
      err(conn, "ROOM_FULL");
      return;
    }
    const token = newToken();
    room.seats[seatPlayer] = { token, conn, disconnectedAt: null };
    conns.set(conn, { code, player: seatPlayer });
    send(conn, { t: "joined", room: code, me: seatPlayer, token });
    sendState(room, seatPlayer);
    send(conn, { t: "opponent", status: opponentStatus(room, seatPlayer) });
    const otherSeat = room.seats[other(seatPlayer)];
    if (otherSeat !== null && otherSeat.conn !== null) {
      send(otherSeat.conn, { t: "opponent", status: "connected" });
    }
  }

  function handleResume(conn: ConnId, code: RoomCode, token: string): void {
    if (conns.has(conn)) {
      err(conn, "ALREADY_IN_ROOM");
      return;
    }
    const room = rooms.get(code);
    if (room === undefined) {
      err(conn, "ROOM_NOT_FOUND");
      return;
    }
    const p1Seat = room.seats.p1;
    if (p1Seat !== null && p1Seat.token === token) {
      resumeSeat(room, conn, "p1", p1Seat);
      return;
    }
    const p2Seat = room.seats.p2;
    if (p2Seat !== null && p2Seat.token === token) {
      resumeSeat(room, conn, "p2", p2Seat);
      return;
    }
    err(conn, "BAD_TOKEN");
  }

  function resumeSeat(room: Room, conn: ConnId, p: PlayerId, seat: Seat): void {
    if (seat.conn !== null) {
      conns.delete(seat.conn);
    }
    seat.conn = conn;
    seat.disconnectedAt = null;
    conns.set(conn, { code: room.code, player: p });
    send(conn, { t: "joined", room: room.code, me: p, token: seat.token });
    sendState(room, p);
    send(conn, { t: "opponent", status: opponentStatus(room, p) });
    const otherSeat = room.seats[other(p)];
    if (otherSeat !== null && otherSeat.conn !== null) {
      send(otherSeat.conn, { t: "opponent", status: "connected" });
    }
  }

  function runAction(room: Room, conn: ConnId, p: PlayerId, action: MatchAction): void {
    const result = applyAction(room.match, action);
    if (result.ok === false) {
      err(conn, result.error);
      return;
    }
    const wasFinished = room.match.phase === "finished";
    room.match = result.value;
    if (!wasFinished && room.match.phase === "finished") {
      room.lastWinner = room.match.winner;
      log("match_finished", { code: room.code, winner: room.match.winner });
    }
    broadcastState(room);
  }

  function handlePlace(conn: ConnId, fleet: Fleet): void {
    const seated = conns.get(conn);
    if (seated === undefined) {
      err(conn, "NOT_IN_ROOM");
      return;
    }
    const room = rooms.get(seated.code);
    if (room === undefined) {
      err(conn, "NOT_IN_ROOM");
      return;
    }
    runAction(room, conn, seated.player, { type: "place", player: seated.player, fleet });
  }

  function handleFire(conn: ConnId, coord: Coord): void {
    const seated = conns.get(conn);
    if (seated === undefined) {
      err(conn, "NOT_IN_ROOM");
      return;
    }
    const room = rooms.get(seated.code);
    if (room === undefined) {
      err(conn, "NOT_IN_ROOM");
      return;
    }
    runAction(room, conn, seated.player, { type: "fire", player: seated.player, coord });
  }

  function handleRematch(conn: ConnId): void {
    const seated = conns.get(conn);
    if (seated === undefined) {
      err(conn, "NOT_IN_ROOM");
      return;
    }
    const room = rooms.get(seated.code);
    if (room === undefined) {
      err(conn, "NOT_IN_ROOM");
      return;
    }
    if (room.match.phase !== "finished") return;
    room.rematch.add(seated.player);
    const bothSeated = room.seats.p1 !== null && room.seats.p2 !== null;
    const bothVoted = room.rematch.has("p1") && room.rematch.has("p2");
    if (!bothSeated || !bothVoted) return;
    const lastWinner = room.lastWinner;
    room.match = createMatch(lastWinner === null ? "p1" : other(lastWinner));
    room.rematch.clear();
    broadcastState(room);
  }

  function handleLeave(conn: ConnId): void {
    const seated = conns.get(conn);
    if (seated === undefined) {
      err(conn, "NOT_IN_ROOM");
      return;
    }
    const room = rooms.get(seated.code);
    if (room === undefined) {
      err(conn, "NOT_IN_ROOM");
      return;
    }
    freeSeat(room, seated.player);
  }

  function handleDisconnect(conn: ConnId): void {
    const seated = conns.get(conn);
    if (seated === undefined) return;
    const room = rooms.get(seated.code);
    if (room === undefined) return;
    conns.delete(conn);
    const seat = room.seats[seated.player];
    if (seat === null) return;
    seat.conn = null;
    seat.disconnectedAt = now();
    const otherSeat = room.seats[other(seated.player)];
    if (otherSeat !== null && otherSeat.conn !== null) {
      send(otherSeat.conn, { t: "opponent", status: "disconnected" });
    }
  }

  function sweep(): void {
    const t = now();
    const expired: { room: Room; p: PlayerId }[] = [];
    for (const room of rooms.values()) {
      const p1Seat = room.seats.p1;
      if (
        p1Seat !== null &&
        p1Seat.disconnectedAt !== null &&
        t - p1Seat.disconnectedAt >= RECONNECT_GRACE_MS
      ) {
        expired.push({ room, p: "p1" });
      }
      const p2Seat = room.seats.p2;
      if (
        p2Seat !== null &&
        p2Seat.disconnectedAt !== null &&
        t - p2Seat.disconnectedAt >= RECONNECT_GRACE_MS
      ) {
        expired.push({ room, p: "p2" });
      }
    }
    for (const entry of expired) {
      freeSeat(entry.room, entry.p);
    }
    const stale: RoomCode[] = [];
    for (const room of rooms.values()) {
      const times: number[] = [];
      let connected = false;
      for (const seat of [room.seats.p1, room.seats.p2]) {
        if (seat === null) continue;
        if (seat.conn !== null) connected = true;
        if (seat.disconnectedAt !== null) times.push(seat.disconnectedAt);
      }
      if (connected || times.length === 0) continue;
      const mostRecent = Math.max(...times);
      if (t - mostRecent >= EMPTY_ROOM_TTL_MS) stale.push(room.code);
    }
    for (const code of stale) {
      rooms.delete(code);
    }
  }

  return {
    handleMessage(conn, msg) {
      switch (msg.t) {
        case "create":
          handleCreate(conn);
          return;
        case "join":
          handleJoin(conn, msg.room);
          return;
        case "resume":
          handleResume(conn, msg.room, msg.token);
          return;
        case "place":
          handlePlace(conn, msg.fleet);
          return;
        case "fire":
          handleFire(conn, msg.coord);
          return;
        case "rematch":
          handleRematch(conn);
          return;
        case "leave":
          handleLeave(conn);
          return;
      }
    },
    handleDisconnect,
    sweep,
    roomCount: () => rooms.size,
  };
}
