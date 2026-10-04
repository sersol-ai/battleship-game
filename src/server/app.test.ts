import { describe, expect, it } from "vitest";
import { startServer } from "./app.ts";
import type { ClientMessage, OpponentStatus, ProtocolError } from "../shared/protocol.ts";
import type { Fleet, PlayerId } from "../shared/types.ts";
import { WebSocket } from "ws";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const WAIT_MS = 2_000;
const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

const FLEET: Fleet = [
  { type: "carrier", x: 0, y: 0, orientation: "H" },
  { type: "battleship", x: 0, y: 2, orientation: "H" },
  { type: "cruiser", x: 0, y: 4, orientation: "H" },
  { type: "submarine", x: 0, y: 6, orientation: "H" },
  { type: "destroyer", x: 0, y: 8, orientation: "H" },
];

interface Frame {
  t: string;
  room?: string;
  me?: PlayerId;
  token?: string;
  code?: ProtocolError;
  status?: OpponentStatus;
}

interface Watched {
  socket: WebSocket;
  received: Frame[];
  error: string | null;
  opened: boolean;
  closed: boolean;
  cursor: number;
}

function connect(port: number, path: string = "/ws"): Watched {
  const socket = new WebSocket(`ws://127.0.0.1:${port}${path}`);
  const watched: Watched = {
    socket,
    received: [],
    error: null,
    opened: false,
    closed: false,
    cursor: 0,
  };
  socket.on("open", () => {
    watched.opened = true;
  });
  socket.on("message", (data) => {
    const frame: Frame = JSON.parse(data.toString());
    watched.received.push(frame);
  });
  socket.on("error", (error) => {
    watched.error = String(error);
  });
  socket.on("close", () => {
    watched.closed = true;
  });
  return watched;
}

async function waitOpen(w: Watched): Promise<void> {
  const deadline = Date.now() + WAIT_MS;
  while (!w.opened) {
    if (Date.now() > deadline) throw new Error("the socket never opened");
    await new Promise((done) => {
      setTimeout(done, 10);
    });
  }
}

async function sendRaw(w: Watched, raw: string): Promise<void> {
  await waitOpen(w);
  w.socket.send(raw);
}

async function send(w: Watched, msg: ClientMessage): Promise<void> {
  await waitOpen(w);
  w.socket.send(JSON.stringify(msg));
}

async function waitFor(w: Watched, t: string): Promise<Frame> {
  const deadline = Date.now() + WAIT_MS;
  while (true) {
    while (w.cursor < w.received.length) {
      const frame = w.received[w.cursor];
      w.cursor += 1;
      if (frame !== undefined && frame.t === t) return frame;
    }
    if (Date.now() > deadline) throw new Error(`no "${t}" message within ${WAIT_MS} ms`);
    await new Promise((done) => {
      setTimeout(done, 10);
    });
  }
}

async function waitForOpponent(w: Watched, status: OpponentStatus): Promise<void> {
  const deadline = Date.now() + WAIT_MS;
  while (true) {
    let found = -1;
    for (let i = w.cursor; i < w.received.length; i += 1) {
      const frame = w.received[i];
      if (frame !== undefined && frame.t === "opponent" && frame.status === status) {
        found = i;
        break;
      }
    }
    if (found >= 0) {
      w.cursor = found + 1;
      return;
    }
    if (Date.now() > deadline)
      throw new Error(`no opponent "${status}" message within ${WAIT_MS} ms`);
    await new Promise((done) => {
      setTimeout(done, 10);
    });
  }
}

async function waitForSocketError(w: Watched): Promise<string> {
  const deadline = Date.now() + WAIT_MS;
  while (w.error === null) {
    if (Date.now() > deadline) throw new Error("the socket never errored");
    await new Promise((done) => {
      setTimeout(done, 10);
    });
  }
  return w.error;
}

async function withServer(run: (port: number) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "app-static-"));
  try {
    await writeFile(join(dir, "index.html"), "<!doctype html><html><body>app</body></html>");
    const server = await startServer({ port: 0, staticDir: dir });
    try {
      await run(server.port);
    } finally {
      await server.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("server", () => {
  it("healthz", async (): Promise<void> => {
    await withServer(async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/healthz`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/json");
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.rooms).toBe(0);
    });
  });

  it("two clients play", async (): Promise<void> => {
    await withServer(async (port) => {
      const a = connect(port);
      await send(a, { t: "create" });
      const joined = await waitFor(a, "joined");
      expect(joined.room).toMatch(ROOM_CODE_RE);
      expect(joined.me).toBe("p1");
      expect(typeof joined.token).toBe("string");
      await send(a, { t: "place", fleet: FLEET });

      const b = connect(port);
      await send(b, { t: "join", room: joined.room ?? "" });
      const joinedB = await waitFor(b, "joined");
      expect(joinedB.me).toBe("p2");
      await send(b, { t: "place", fleet: FLEET });

      await waitForOpponent(a, "connected");
      await waitForOpponent(b, "connected");
      await waitFor(a, "state");
      await waitFor(b, "state");
    });
  });

  it("garbage frame", async (): Promise<void> => {
    await withServer(async (port) => {
      const c = connect(port);
      await sendRaw(c, "garbage");
      const err = await waitFor(c, "error");
      expect(err.code).toBe("BAD_MESSAGE");
      expect(c.closed).toBe(false);
      await sendRaw(c, JSON.stringify({ t: "create" }));
      await waitFor(c, "joined");
    });
  });

  it("bad upgrade path", async (): Promise<void> => {
    await withServer(async (port) => {
      const bad = connect(port, "/other");
      const reason = await waitForSocketError(bad);
      expect(reason.length > 0).toBe(true);
    });
  });

  it("disconnect", async (): Promise<void> => {
    await withServer(async (port) => {
      const a = connect(port);
      await send(a, { t: "create" });
      const joined = await waitFor(a, "joined");
      await send(a, { t: "place", fleet: FLEET });
      const b = connect(port);
      await send(b, { t: "join", room: joined.room ?? "" });
      await waitFor(b, "joined");
      await send(b, { t: "place", fleet: FLEET });
      await waitForOpponent(a, "connected");
      b.socket.close();
      await waitForOpponent(a, "disconnected");
    });
  });

  it("close stops the port", async (): Promise<void> => {
    const dir = await mkdtemp(join(tmpdir(), "app-closed-"));
    try {
      await writeFile(join(dir, "index.html"), "<!doctype html><html><body>closed</body></html>");
      const server = await startServer({ port: 0, staticDir: dir });
      const open = await fetch(`http://127.0.0.1:${server.port}/healthz`);
      expect(open.status).toBe(200);
      await server.close();
      let refused = false;
      try {
        await fetch(`http://127.0.0.1:${server.port}/healthz`);
      } catch {
        refused = true;
      }
      expect(refused).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
