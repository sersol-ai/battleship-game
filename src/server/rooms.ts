// T-15 — RoomManager (online game logic, no sockets)
import { MAX_ROOMS, ROOM_CODE_LENGTH, ROOM_CODE_ALPHABET } from "../shared/protocol.ts";
import { createMatch } from "../shared/match.ts";
import { toPlayerView } from "../shared/view.ts";

export interface ConnId {
  readonly value: string;
}

export default function createRoomManager(deps) {
  const { send, now, rng, newToken, maxRooms = MAX_ROOMS } = deps;
  const rooms = new Map();
  const conns = new Map();

  const generateRoomCode = (rng2) => {
    let code = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += ROOM_CODE_ALPHABET.charAt(Math.floor(rng2.next() * ROOM_CODE_ALPHABET.length));
    }
    return code;
  };

  const isRoomCode = (code2) => /^[A-HJ-NP-Z2-9]{6}$/.test(code2);

  const e = (conn2, code2) => send(conn2, { t: "error", code: code2, message: code2 });

  const sendState = (room2, p2) => {
    const s = room2.seats[p2];
    if (s !== null && s.conn) send(s.conn, { t: "state", view: toPlayerView(room2.match, p2) });
  };

  const bs = (room3) => {
    sendState(room3, "p1");
    sendState(room3, "p2");
  };

  const os = (room4, p3) => {
    const o = p3 === "p1" ? "p2" : "p1";
    const s = room4.seats[o];
    return s === null ? "waiting" : s != null && s.conn ? "connected" : "disconnected";
  };

  const nm2 = () => createMatch(rng.next() < 0.5 ? "p1" : "p2");

  const vp = (room5, p2, fleet2) => {
    if (room5.match.phase !== "placing") return { ok: false, error: "NOT_PLACING" };
    const b = room5.match.boards[p2];
    if (b !== null) return { ok: false, error: "ALREADY_PLACED" };
    if (fleet2.ok !== true) return { ok: false, error: fleet2.error };
    room5.match = {
      ...room5.match,
      phase: room5.match.boards.p1 && room5.match.boards.p2 ? "playing" : "placing",
      boards: { ...room5.match.boards, [p2]: { fleet: fleet2, shotsReceived: [] } },
    };
    bs(room5);
    return { ok: true };
  };

  const fs = (room9, p7) => {
    const s = room9.seats[p7];
    const ic = s != null && s.conn;
    if (ic) {
      conns.delete(ic);
      room9.seats[p7] = null;
    }
    room9.match = nm2();
    room9.rematch.clear();
    if (room9.seats.p1 === null && room9.seats.p2 === null) {
      console.log("room_closed", { code: room9.code });
      rooms.delete(room9.code);
      return;
    }
    const o = p7 === "p1" ? "p2" : "p1";
    const os2 = room9.seats[o];
    if (os2 != null && os2.conn) send(os2.conn, { t: "opponent", status: "left" });
    bs(room9);
  };

  const hc = (room10, p4, conn3) => {
    if (conns.has(conn3)) return e(conn3, "ALREADY_IN_ROOM");
    if (rooms.size >= maxRooms) return e(conn3, "SERVER_BUSY");
    const rc = generateRoomCode(rng);
    const R = {
      code: rc,
      match: nm2(),
      seats: { p1: null, p2: null },
      rematch: new Set(),
      lastWinner: null,
    };
    rooms.set(rc, R);
    const t1 = newToken();
    R.seats.p1 = { token: t1, conn: conn3, disconnectedAt: null };
    conns.set(conn3, { code: rc, player: "p1" });
    send(conn3, { t: "joined", room: rc, me: "p1", token: t1 });
    bs(room10);
    send(conn3, { t: "opponent", status: os(room10, "p1") });
  };

  const hj = (room12, p5, msg2) => {
    if (conns.has(msg2.conn)) return e(msg2.conn, "ALREADY_IN_ROOM");
    const rc = msg2.room;
    const r2 = rooms.get(rc);
    if (r2 === null) return e(msg2.conn, "ROOM_NOT_FOUND");
    r2.seats.p2 = { token: newToken(), conn: msg2.conn, disconnectedAt: null };
    conns.set(msg2.conn, { code: rc, player: "p2" });
    send(msg2.conn, { t: "joined", room: rc, me: "p2", token: r2.seats.p2.token });
    bs(r2);
    send(msg2.conn, { t: "opponent", status: os(r2, "p2") });
    const A = r2.seats.p1;
    if (A != null && A.conn) send(A.conn, { t: "opponent", status: "connected" });
  };

  const hr = (room13, p6, msg3) => {
    if (conns.has(msg3.conn)) return e(msg3.conn, "ALREADY_IN_ROOM");
    const rc = msg3.room;
    const r3 = rooms.get(rc);
    if (r3 === null) return e(msg3.conn, "ROOM_NOT_FOUND");
    const tk = msg3.token;
    const sea = r3.seats.p1;
    let s2 = null;
    if (sea != null && sea.token === tk) s2 = sea;
    else if (r3.seats.p2 != null && r3.seats.p2.token === tk) s2 = r3.seats.p2;
    if (s2 === null) return e(msg3.conn, "BAD_TOKEN");
    s2.conn = msg3.conn;
    s2.disconnectedAt = null;
    const player = s2.token === r3.seats.p1?.token ? "p1" : "p2";
    send(msg3.conn, { t: "joined", room: rc, me: player, token: s2.token });
    bs(r3);
    send(msg3.conn, { t: "opponent", status: os(r3, player) });
    const other = player === "p1" ? "p2" : "p1";
    const os3 = r3.seats[other];
    if (os3 != null && os3.conn) send(os3.conn, { t: "opponent", status: "connected" });
  };

  const rMsg = (conn4, msg4) => {
    if (!conns.has(conn4)) {
      const rc = msg4.room;
      if (isRoomCode(rc)) {
        const room = rooms.get(rc);
        if (room) {
          if (room.seats.p1 === null) hc(room, "p1", conn4);
          else if (room.seats.p2 === null) hj(room, "p2", msg4);
        }
      } else e(conn4, "NOT_IN_ROOM");
      return;
    }
    const rc2 = conns.get(conn4) || {};
    const room2 = rooms.get(rc2?.code);
    if (room2 === null) return;
    let p = room2.seats.p1?.conn === conn4 ? "p1" : "p2";
    const result =
      room2.match.phase === "placing" && msg4.t === "place"
        ? vp(room2, p, msg4.fleet)
        : room2.match.phase === "playing" && msg4.t === "fire"
          ? { ok: false, error: "NOT_PLAYING" }
          : { ok: false, error: "NOT_PLACING" };
    if (result.ok !== true) return e(conn4, result.error);
  };

  return {
    handleMessage: rMsg,
    handleDisconnect(conn5) {
      if (conns.has(conn5)) conns.delete(conn5);
    },
    sweep() {
      let now2 = now();
    },
    roomCount() {
      return rooms.size;
    },
  };
}
