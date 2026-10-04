import { describe, expect, it } from "vitest";
import { createOnlineController } from "./online-controller.ts";
import type { OnlineIntent } from "./online-controller.ts";
import { FakeWebSocket, fakeFactory } from "./fake-websocket.ts";
import type { GameController } from "./controller.ts";
import type { PlayerView } from "../shared/types.ts";

const SESSION_KEY = "battleship.session";
const VIEW: PlayerView = {
  me: "p1",
  phase: "playing",
  isMyTurn: true,
  winner: null,
  myPlaced: true,
  enemyPlaced: true,
  myGrid: [["empty"]],
  enemyGrid: [["unknown"]],
  enemyShipsRemaining: [],
  myShipsRemaining: [],
  lastShot: null,
};

function sleep(ms: number): Promise<void> {
  return new Promise((done) => {
    void setTimeout(done, ms);
  });
}

function makeStorage(
  store: Record<string, string>,
): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => {
      store[key] = value;
      return null;
    },
    removeItem: (key) => {
      delete store[key];
    },
  };
}

function start(
  intent: OnlineIntent,
  store: Record<string, string>,
): { controller: GameController; socket: FakeWebSocket } {
  const controller = createOnlineController({
    intent,
    url: "ws://fake/ws",
    createSocket: fakeFactory,
    storage: makeStorage(store),
  });
  const last = FakeWebSocket.instances.at(-1);
  if (last === undefined) throw new Error("no fake socket created yet");
  return { controller, socket: last };
}

describe("online controller", () => {
  it("create intent sends create, joined stores the session", async (): Promise<void> => {
    const store: Record<string, string> = {};
    const started = start({ kind: "create" }, store);
    started.socket.serverOpen();
    expect(started.socket.sent).toEqual(['{"t":"create"}']);
    started.socket.serverSend({ t: "joined", room: "ABCDEF", me: "p1", token: "tok1" });
    expect(started.controller.getSnapshot().room).toBe("ABCDEF");
    expect(store[SESSION_KEY]).toBe(JSON.stringify({ room: "ABCDEF", token: "tok1" }));
  });

  it("state and opponent messages update the snapshot", async (): Promise<void> => {
    const store: Record<string, string> = {};
    const started = start({ kind: "create" }, store);
    started.socket.serverOpen();
    started.socket.serverSend({ t: "state", view: VIEW });
    expect(started.controller.getSnapshot().view).toEqual(VIEW);
    started.socket.serverSend({ t: "opponent", status: "connected" });
    expect(started.controller.getSnapshot().opponent).toBe("connected");
  });

  it("a closed server reconnects and resumes with the token", async (): Promise<void> => {
    const store: Record<string, string> = {};
    const started = start({ kind: "create" }, store);
    started.socket.serverOpen();
    started.socket.serverSend({ t: "joined", room: "ABCDEF", me: "p1", token: "tok1" });
    started.socket.serverClose();
    expect(started.controller.getSnapshot().connection).toBe("reconnecting");
    const openedAt = FakeWebSocket.instances.length;
    const deadline = Date.now() + 3_000;
    while (FakeWebSocket.instances.length <= openedAt && Date.now() < deadline) {
      await sleep(10);
    }
    const second = FakeWebSocket.instances.at(-1);
    if (second === undefined) throw new Error("no reconnect socket created");
    second.serverOpen();
    expect(second.sent).toEqual(['{"t":"resume","room":"ABCDEF","token":"tok1"}']);
  });

  it("a stale stored session falls back to join", async (): Promise<void> => {
    const store: Record<string, string> = {
      [SESSION_KEY]: JSON.stringify({ room: "ZZZZZZ", token: "tok9" }),
    };
    const started = start({ kind: "join", room: "ZZZZZZ" }, store);
    started.socket.serverOpen();
    expect(started.socket.sent).toEqual(['{"t":"resume","room":"ZZZZZZ","token":"tok9"}']);
    started.socket.serverSend({ t: "error", code: "BAD_TOKEN", message: "Invalid token" });
    expect(started.socket.sent.at(-1)).toEqual('{"t":"join","room":"ZZZZZZ"}');
    expect(store[SESSION_KEY]).toBeUndefined();
  });

  it("error text shows and the next state clears it", async (): Promise<void> => {
    const store: Record<string, string> = {};
    const started = start({ kind: "create" }, store);
    started.socket.serverOpen();
    started.socket.serverSend({ t: "error", code: "ROOM_FULL", message: "Room is full" });
    expect((started.controller.getSnapshot().error ?? "").length > 0).toBe(true);
    started.socket.serverSend({ t: "state", view: VIEW });
    expect(started.controller.getSnapshot().error).toBeNull();
  });

  it("dispose leaves and clears the session", async (): Promise<void> => {
    const store: Record<string, string> = {};
    const started = start({ kind: "create" }, store);
    started.socket.serverOpen();
    started.socket.serverSend({ t: "joined", room: "ABCDEF", me: "p1", token: "tok1" });
    started.controller.dispose();
    expect(started.socket.sent.at(-1)).toBe('{"t":"leave"}');
    expect(store[SESSION_KEY]).toBeUndefined();
  });
});
