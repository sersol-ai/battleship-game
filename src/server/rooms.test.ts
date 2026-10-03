import { describe, it, expect } from "vitest";
import { createRoomManager } from "./rooms.ts";
import type { ConnId, RoomManager } from "./rooms.ts";
import { EMPTY_ROOM_TTL_MS, RECONNECT_GRACE_MS } from "../shared/protocol.ts";
import type { OpponentStatus, ProtocolError, ServerMessage } from "../shared/protocol.ts";
import type { Coord, Fleet, PlayerId, PlayerView } from "../shared/types.ts";
import { shipCells } from "../shared/board.ts";
import { createRng } from "../shared/rng.ts";
import { FLEET_A, FLEET_B } from "../shared/test-fixtures.ts";

interface Harness {
  manager: RoomManager;
  sent: { conn: ConnId; msg: ServerMessage }[];
  clock: { now: number };
  logs: { event: string; data: Record<string, unknown> }[];
}

/** Fresh harness per test: seeded rng, "tok1"/"tok2"… tokens, a clock the test controls. */
function makeHarness(maxRooms?: number): Harness {
  const sent: { conn: ConnId; msg: ServerMessage }[] = [];
  const logs: { event: string; data: Record<string, unknown> }[] = [];
  const clock = { now: 0 };
  let tokenCount = 0;
  const manager = createRoomManager({
    send: (conn, msg) => {
      sent.push({ conn, msg });
    },
    now: () => clock.now,
    rng: createRng(1),
    newToken: () => {
      tokenCount += 1;
      return `tok${tokenCount}`;
    },
    log: (event, data) => {
      logs.push({ event, data });
    },
    maxRooms,
  });
  return { manager, sent, clock, logs };
}

function joinedOf(h: Harness, conn: ConnId): { room: string; me: PlayerId; token: string }[] {
  const out: { room: string; me: PlayerId; token: string }[] = [];
  for (const entry of h.sent) {
    if (entry.conn !== conn) continue;
    const msg = entry.msg;
    if (msg.t === "joined") out.push({ room: msg.room, me: msg.me, token: msg.token });
  }
  return out;
}

function viewsOf(h: Harness, conn: ConnId): PlayerView[] {
  const out: PlayerView[] = [];
  for (const entry of h.sent) {
    if (entry.conn !== conn) continue;
    const msg = entry.msg;
    if (msg.t === "state") out.push(msg.view);
  }
  return out;
}

function statusesOf(h: Harness, conn: ConnId): OpponentStatus[] {
  const out: OpponentStatus[] = [];
  for (const entry of h.sent) {
    if (entry.conn !== conn) continue;
    const msg = entry.msg;
    if (msg.t === "opponent") out.push(msg.status);
  }
  return out;
}

function errorsOf(h: Harness, conn: ConnId): ProtocolError[] {
  const out: ProtocolError[] = [];
  for (const entry of h.sent) {
    if (entry.conn !== conn) continue;
    const msg = entry.msg;
    if (msg.t === "error") out.push(msg.code);
  }
  return out;
}

function lastView(h: Harness, conn: ConnId): PlayerView | undefined {
  const views = viewsOf(h, conn);
  return views[views.length - 1];
}

function eventsOf(h: Harness): string[] {
  return h.logs.map((entry) => entry.event);
}

function leaksShip(view: PlayerView): boolean {
  return view.enemyGrid.some((row) => row.includes("ship"));
}

/** Every cell of a fleet — used to script a game that always ends. */
function cellsOf(fleet: Fleet): Coord[] {
  const out: Coord[] = [];
  for (const ship of fleet) {
    for (const cell of shipCells(ship)) out.push(cell);
  }
  return out;
}

/** create + join + both place + fire until finished. Deterministic: each side shoots known cells. */
function playFinishedGame(h: Harness): void {
  h.manager.handleMessage("A", { t: "create" });
  const code = joinedOf(h, "A")[0]?.room ?? "";
  h.manager.handleMessage("B", { t: "join", room: code });
  h.manager.handleMessage("A", { t: "place", fleet: FLEET_A });
  h.manager.handleMessage("B", { t: "place", fleet: FLEET_B });
  const aTargets = cellsOf(FLEET_B);
  const bTargets = cellsOf(FLEET_A);
  let aIndex = 0;
  let bIndex = 0;
  while (lastView(h, "A")?.phase !== "finished") {
    const aTurn = lastView(h, "A")?.isMyTurn === true;
    const targets = aTurn ? aTargets : bTargets;
    const target = targets[aTurn ? aIndex : bIndex];
    if (target === undefined) break;
    if (aTurn) aIndex += 1;
    else bIndex += 1;
    h.manager.handleMessage(aTurn ? "A" : "B", { t: "fire", coord: target });
  }
}

describe("rooms", () => {
  it("1. create seats p1: joined, state, opponent waiting", () => {
    const h = makeHarness();
    h.manager.handleMessage("A", { t: "create" });
    const joined = joinedOf(h, "A");
    expect(joined).toHaveLength(1);
    expect(joined[0]?.me).toBe("p1");
    expect(joined[0]?.token).toBe("tok1");
    expect(joined[0]?.room).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(viewsOf(h, "A")).toHaveLength(1);
    expect(statusesOf(h, "A")).toEqual(["waiting"]);
    expect(h.manager.roomCount()).toBe(1);
    expect(eventsOf(h)).toEqual(["room_created"]);
    const view = lastView(h, "A");
    expect(view?.phase).toBe("placing");
    expect(view?.myPlaced).toBe(false);
    expect(view?.enemyPlaced).toBe(false);
    expect(view?.isMyTurn).toBe(false);
  });

  it("2. B joins: both learn the opponent is connected", () => {
    const h = makeHarness();
    h.manager.handleMessage("A", { t: "create" });
    const code = joinedOf(h, "A")[0]?.room ?? "";
    h.manager.handleMessage("B", { t: "join", room: code });
    const joined = joinedOf(h, "B");
    expect(joined).toHaveLength(1);
    expect(joined[0]?.me).toBe("p2");
    expect(joined[0]?.token).toBe("tok2");
    expect(joined[0]?.room).toBe(code);
    expect(statusesOf(h, "B")).toEqual(["connected"]);
    expect(statusesOf(h, "A")).toEqual(["waiting", "connected"]);
    expect(viewsOf(h, "B")).toHaveLength(1);
  });

  it("3. ROOM_FULL, ROOM_NOT_FOUND and ALREADY_IN_ROOM", () => {
    const h = makeHarness();
    h.manager.handleMessage("A", { t: "create" });
    const code = joinedOf(h, "A")[0]?.room ?? "";
    h.manager.handleMessage("B", { t: "join", room: code });
    h.manager.handleMessage("C", { t: "join", room: code });
    expect(errorsOf(h, "C")).toEqual(["ROOM_FULL"]);
    h.manager.handleMessage("D", { t: "join", room: "ZZZZZZ" });
    expect(errorsOf(h, "D")).toEqual(["ROOM_NOT_FOUND"]);
    h.manager.handleMessage("A", { t: "create" });
    expect(errorsOf(h, "A")).toEqual(["ALREADY_IN_ROOM"]);
    expect(h.manager.roomCount()).toBe(1);
  });

  it("4. place/fire before create or join is NOT_IN_ROOM", () => {
    const h = makeHarness();
    h.manager.handleMessage("A", { t: "place", fleet: FLEET_A });
    h.manager.handleMessage("A", { t: "fire", coord: { x: 0, y: 0 } });
    h.manager.handleMessage("A", { t: "rematch" });
    h.manager.handleMessage("A", { t: "leave" });
    expect(errorsOf(h, "A")).toEqual(["NOT_IN_ROOM", "NOT_IN_ROOM", "NOT_IN_ROOM", "NOT_IN_ROOM"]);
    expect(viewsOf(h, "A")).toHaveLength(0);
    expect(h.manager.roomCount()).toBe(0);
  });

  it("5. both place, the shooter fires, firing out of turn errors only for them", () => {
    const h = makeHarness();
    h.manager.handleMessage("A", { t: "create" });
    const code = joinedOf(h, "A")[0]?.room ?? "";
    h.manager.handleMessage("B", { t: "join", room: code });
    h.manager.handleMessage("A", { t: "place", fleet: FLEET_A });
    h.manager.handleMessage("B", { t: "place", fleet: FLEET_B });
    expect(lastView(h, "A")?.phase).toBe("playing");
    expect(lastView(h, "B")?.phase).toBe("playing");
    const shooter = lastView(h, "A")?.isMyTurn === true ? "A" : "B";
    const idle = shooter === "A" ? "B" : "A";
    h.manager.handleMessage(shooter, { t: "fire", coord: { x: 9, y: 9 } });
    expect(viewsOf(h, "A")).toHaveLength(4);
    expect(viewsOf(h, "B")).toHaveLength(4);
    h.manager.handleMessage(idle, { t: "fire", coord: { x: 5, y: 5 } });
    expect(viewsOf(h, "A")).toHaveLength(5);
    expect(viewsOf(h, "B")).toHaveLength(5);
    h.manager.handleMessage(idle, { t: "fire", coord: { x: 6, y: 6 } });
    expect(errorsOf(h, idle)).toEqual(["NOT_YOUR_TURN"]);
    expect(errorsOf(h, shooter)).toEqual([]);
    expect(viewsOf(h, shooter)).toHaveLength(5);
  });

  it("6. no leak: enemyGrid shows no ship cell before the match is finished", () => {
    const h = makeHarness();
    playFinishedGame(h);
    const aViews = viewsOf(h, "A");
    expect(aViews.length).toBeGreaterThan(0);
    expect(lastView(h, "A")?.phase).toBe("finished");
    for (const conn of ["A", "B"]) {
      for (const view of viewsOf(h, conn)) {
        if (view.phase === "finished") continue;
        expect(leaksShip(view)).toBe(false);
      }
    }
    expect(eventsOf(h)).toContain("match_finished");
  });

  it("7. disconnect, resume with the right token, BAD_TOKEN with the wrong one", () => {
    const h = makeHarness();
    h.manager.handleMessage("A", { t: "create" });
    const code = joinedOf(h, "A")[0]?.room ?? "";
    h.manager.handleMessage("B", { t: "join", room: code });
    const bToken = joinedOf(h, "B")[0]?.token ?? "";
    h.manager.handleDisconnect("B");
    expect(statusesOf(h, "A")).toEqual(["waiting", "connected", "disconnected"]);
    h.manager.handleMessage("B2", { t: "resume", room: code, token: bToken });
    expect(joinedOf(h, "B2")).toHaveLength(1);
    expect(viewsOf(h, "B2")).toHaveLength(1);
    expect(statusesOf(h, "A")).toEqual(["waiting", "connected", "disconnected", "connected"]);
    h.manager.handleMessage("B3", { t: "resume", room: code, token: "nope" });
    expect(errorsOf(h, "B3")).toEqual(["BAD_TOKEN"]);
    expect(h.manager.roomCount()).toBe(1);
  });

  it("8. grace expiry frees the seat and a new conn can join", () => {
    const h = makeHarness();
    h.manager.handleMessage("A", { t: "create" });
    const code = joinedOf(h, "A")[0]?.room ?? "";
    h.manager.handleMessage("B", { t: "join", room: code });
    h.manager.handleDisconnect("B");
    h.clock.now += RECONNECT_GRACE_MS;
    h.manager.sweep();
    expect(statusesOf(h, "A")).toEqual(["waiting", "connected", "disconnected", "left"]);
    expect(lastView(h, "A")?.phase).toBe("placing");
    expect(lastView(h, "A")?.myPlaced).toBe(false);
    h.manager.handleMessage("C", { t: "join", room: code });
    expect(joinedOf(h, "C")).toHaveLength(1);
    expect(joinedOf(h, "C")[0]?.me).toBe("p2");
    expect(h.manager.roomCount()).toBe(1);
  });

  it("9. both seats expire: the room is deleted", () => {
    const h = makeHarness();
    h.manager.handleMessage("A", { t: "create" });
    const code = joinedOf(h, "A")[0]?.room ?? "";
    h.manager.handleMessage("B", { t: "join", room: code });
    h.manager.handleDisconnect("A");
    h.manager.handleDisconnect("B");
    h.clock.now += RECONNECT_GRACE_MS + EMPTY_ROOM_TTL_MS;
    h.manager.sweep();
    expect(h.manager.roomCount()).toBe(0);
    expect(eventsOf(h)).toContain("room_closed");
  });

  it("10. rematch needs both votes; the loser starts the new match", () => {
    const h = makeHarness();
    playFinishedGame(h);
    const winner = lastView(h, "A")?.winner;
    expect(winner === "p1" || winner === "p2").toBe(true);
    const winnerConn = winner === "p2" ? "B" : "A";
    const loserConn = winner === "p2" ? "A" : "B";
    const before = viewsOf(h, "A").length;
    h.manager.handleMessage(winnerConn, { t: "rematch" });
    expect(viewsOf(h, "A")).toHaveLength(before);
    h.manager.handleMessage(loserConn, { t: "rematch" });
    expect(viewsOf(h, "A")).toHaveLength(before + 1);
    expect(lastView(h, "A")?.phase).toBe("placing");
    expect(lastView(h, "A")?.myPlaced).toBe(false);
    h.manager.handleMessage("A", { t: "place", fleet: FLEET_A });
    h.manager.handleMessage("B", { t: "place", fleet: FLEET_B });
    expect(lastView(h, loserConn)?.isMyTurn).toBe(true);
    expect(lastView(h, winnerConn)?.isMyTurn).toBe(false);
  });

  it("11. maxRooms 2: the third create is SERVER_BUSY", () => {
    const h = makeHarness(2);
    h.manager.handleMessage("A", { t: "create" });
    h.manager.handleMessage("B", { t: "create" });
    h.manager.handleMessage("C", { t: "create" });
    expect(errorsOf(h, "C")).toEqual(["SERVER_BUSY"]);
    expect(h.manager.roomCount()).toBe(2);
  });

  it("extra: optional deps (no log, default maxRooms) still work", () => {
    let joined = 0;
    const manager = createRoomManager({
      send: (conn, msg) => {
        if (msg.t === "joined") joined += 1;
      },
      now: () => 0,
      rng: createRng(7),
      newToken: () => "tok",
    });
    manager.handleMessage("A", { t: "create" });
    manager.handleMessage("B", { t: "create" });
    expect(joined).toBe(2);
    expect(manager.roomCount()).toBe(2);
    manager.handleDisconnect("nobody");
    manager.sweep();
    expect(manager.roomCount()).toBe(2);
  });

  it("extra: leave frees the seat and the room closes when both go", () => {
    const h = makeHarness();
    h.manager.handleMessage("A", { t: "create" });
    const code = joinedOf(h, "A")[0]?.room ?? "";
    h.manager.handleMessage("B", { t: "join", room: code });
    h.manager.handleMessage("B", { t: "leave" });
    expect(statusesOf(h, "A")).toEqual(["waiting", "connected", "left"]);
    h.manager.handleMessage("A", { t: "leave" });
    expect(h.manager.roomCount()).toBe(0);
    expect(eventsOf(h)).toEqual(["room_created", "room_closed"]);
  });
});
