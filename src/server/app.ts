// T-16 — Server: HTTP + WebSocket wiring

import http, { IncomingMessage, ServerResponse } from "node:http";
import { WebSocketServer } from "ws";
import { MAX_MESSAGE_BYTES } from "../shared/protocol.ts";
import { parseClientMessage } from "../shared/guards.ts";
import rooms from "./rooms.ts";

interface ConnId {
  conn: WebSocket;
  readyState: number;
}

class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private sockets: Map<string, ConnId> = new Map();

  constructor() {}

  create(): { ok: boolean; value?: string; error?: string } {
    if (this.rooms.size >= 500) return { ok: false, error: "SERVER_BUSY" };
    const code = generateRoomCode();
    const room: Room = { code, players: new Set() };
    this.rooms.set(code, room);
    return { ok: true, value: code };
  }

  join(code: string): { ok: boolean; error?: string; value?: string } {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: "ROOM_NOT_FOUND" };
    if (room.players.size >= 2) return { ok: false, error: "ROOM_FULL" };
    return { ok: true, value: code };
  }

  resume(code: string, token: string): { ok: boolean; error?: string } {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: "ROOM_NOT_FOUND" };
    if (!room.players.has(token)) return { ok: false, error: "BAD_TOKEN" };
    return { ok: true };
  }

  leave(code: string, token: string) {
    const room = this.rooms.get(code);
    room?.players.delete(token);
  }

  onAddConnection(connId: string) {
    const entry: ConnId = { conn: {} as WebSocket, readyState: 0 };
    this.sockets.set(connId, entry);
  }

  onRemoveConnection(connId: string) {
    const e = this.sockets.get(connId);
    if (e) {
      if (e.readyState === 1) {
        this.send(connId, JSON.stringify({ t: "error", code: "NOT_IN_ROOM", message: "Disconnected" }));
      }
      this.sockets.delete(connId);
    }
  }

  onMessage(connId: string, msg: string) {
    const e = this.sockets.get(connId);
    if (e && msg === "pong") e.readyState = 1;
  }

  send(connId: string, msg: string) {
    const e = this.sockets.get(connId);
    if (e && e.readyState === 1) e.conn.send(msg);
  }

  disconnect(connId: string) {
    this.onRemoveConnection(connId);
  }

  startPing() {
    setInterval(() => {
      for (const e of this.sockets.values()) {
        if (!e) continue;
        if (!e.readyState) e.conn.terminate();
        else e.readyState = 1;
      }
    }, 30_000);
  }

  sweep() {
    setInterval(() => {
      for (const e of this.sockets.values()) {
        if (!e) continue;
        if (!e.readyState) e.conn.terminate();
        else e.readyState = 1;
      }
    }, 10_000);
  }

  size() { return this.rooms.size; }

  private readonly intervals = new Set<number>();
}

const rooms = new RoomManager();
export default rooms;
