import { createServer } from "node:http";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { MAX_MESSAGE_BYTES } from "../shared/protocol.ts";
import type { IncomingMessage } from "node:http";
import type { ServerMessage } from "../shared/protocol.ts";
import { parseClientMessage } from "../shared/guards.ts";
import { createRng } from "../shared/rng.ts";
import { createRoomManager } from "./rooms.ts";
import type { ConnId } from "./rooms.ts";
import { createStaticHandler } from "./static.ts";
import { WebSocket, WebSocketServer } from "ws";
import type { Duplex } from "node:stream";

const DEFAULT_SWEEP_INTERVAL_MS = 10_000;
const DEFAULT_PING_INTERVAL_MS = 30_000;

export interface ServerOptions {
  port: number; // 0 = random (tests)
  staticDir: string;
  sweepIntervalMs?: number; // default 10_000
  pingIntervalMs?: number; // default 30_000
}

export interface RunningServer {
  port: number; // actual bound port
  close(): Promise<void>; // clears intervals, terminates all sockets, closes http server
}

export async function startServer(opts: ServerOptions): Promise<RunningServer> {
  const sweepIntervalMs = opts.sweepIntervalMs ?? DEFAULT_SWEEP_INTERVAL_MS;
  const pingIntervalMs = opts.pingIntervalMs ?? DEFAULT_PING_INTERVAL_MS;

  const sockets = new Map<ConnId, WebSocket>();
  const alive = new Map<ConnId, boolean>();

  function log(event: string, data: Record<string, unknown>): void {
    console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...data }));
  }

  function send(conn: ConnId, msg: ServerMessage): void {
    const socket = sockets.get(conn);
    if (socket === undefined || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(msg));
  }

  const manager = createRoomManager({
    send,
    now: Date.now,
    rng: createRng(randomInt(2 ** 32)),
    newToken: () => randomBytes(16).toString("hex"),
    log: (event, data) => {
      log(event, data);
    },
  });

  const staticHandler = createStaticHandler(opts.staticDir);

  function isHealthz(url: string | undefined): boolean {
    try {
      return new URL(url ?? "/", "http://x").pathname === "/healthz";
    } catch {
      return false;
    }
  }

  const httpServer = createServer((req, res) => {
    if (req.method === "GET" && isHealthz(req.url)) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, rooms: manager.roomCount() }));
      return;
    }
    staticHandler(req, res);
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });

  wss.on("connection", (ws) => {
    const conn = randomUUID();
    sockets.set(conn, ws);
    alive.set(conn, true);

    ws.on("message", (data, isBinary) => {
      try {
        if (isBinary) {
          send(conn, {
            t: "error",
            code: "BAD_MESSAGE",
            message: "Binary frames are not accepted.",
          });
          return;
        }
        const msg = parseClientMessage(data.toString());
        if (msg === null) {
          send(conn, { t: "error", code: "BAD_MESSAGE", message: "That message is not allowed." });
          return;
        }
        manager.handleMessage(conn, msg);
      } catch (error) {
        log("handler_error", { conn, error: String(error) });
      }
    });

    ws.on("pong", () => {
      alive.set(conn, true);
    });

    ws.on("close", () => {
      sockets.delete(conn);
      alive.delete(conn);
      manager.handleDisconnect(conn);
    });

    ws.on("error", (error) => {
      log("socket_error", { conn, error: String(error) });
    });
  });

  httpServer.on("upgrade", (req: IncomingMessage, socket: Duplex, headers: Buffer) => {
    let pathname = "";
    try {
      pathname = new URL(req.url ?? "/", "http://x").pathname;
    } catch {
      socket.destroy();
      return;
    }
    if (pathname !== "/ws") {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, headers, (client) => {
      wss.emit("connection", client, req);
    });
  });

  const pingTimer = setInterval(() => {
    for (const [conn, ws] of sockets) {
      if (!alive.get(conn)) {
        ws.terminate();
        continue;
      }
      alive.set(conn, false);
      ws.ping();
    }
  }, pingIntervalMs);

  const sweepTimer = setInterval(() => {
    manager.sweep();
  }, sweepIntervalMs);

  httpServer.listen(opts.port);
  const address = httpServer.address();
  if (address === null || typeof address === "string") {
    throw new Error("the http server did not bind a port");
  }
  const port = address.port;
  log("server_started", { port });

  return {
    port,
    close: async (): Promise<void> => {
      clearInterval(pingTimer);
      clearInterval(sweepTimer);
      for (const ws of sockets.values()) ws.terminate();
      sockets.clear();
      alive.clear();
      wss.close();
      await httpServer.close();
    },
  };
}
