// Browser-side WebSocket transport: keeps one socket alive, reopens it with
// backoff when the server (or the network) drops it, and never loses messages:
// anything sent while the socket is down is queued and replayed on the next open.

import type { ClientMessage, ServerMessage } from "../shared/protocol.ts";
import type { ConnectionState } from "./controller.ts";

export interface WsLike {
  readyState: number; // 0 connecting, 1 open, 2 closing, 3 closed
  send(data: string): void;
  close(): void;
  onopen: ((ev: unknown) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

export interface WsClientOptions {
  url: string;
  onOpen(): void; // every successful (re)connect
  onMessage(msg: ServerMessage): void;
  onState(s: ConnectionState): void;
  createSocket?: (url: string) => WsLike; // default: (u) => new WebSocket(u)
  backoffMs?: readonly number[]; // default [500, 1000, 2000, 4000, 8000]; last value repeats
}

export interface WsClient {
  send(msg: ClientMessage): void;
  close(): void;
}

const DEFAULT_BACKOFF_MS: readonly number[] = [500, 1000, 2000, 4000, 8000];
const MAX_QUEUED = 20;

export function createWsClient(opts: WsClientOptions): WsClient {
  const createSocket = opts.createSocket ?? ((url: string) => new WebSocket(url) as WsLike);
  const backoff = opts.backoffMs ?? DEFAULT_BACKOFF_MS;
  const queued: ClientMessage[] = [];
  let socket: WsLike | null = null;
  let isOpen = false;
  let shuttingDown = false;
  let attempt = 0;

  function setState(state: ConnectionState): void {
    opts.onState(state);
  }

  function attach(sock: WsLike): void {
    socket = sock;
    setState("connecting");
    sock.onopen = () => {
      handleOpen();
    };
    sock.onclose = () => {
      handleClose();
    };
    sock.onmessage = (ev) => {
      handleMessage(ev.data);
    };
    sock.onerror = () => {
      // The browser always fires "close" after "error"; reconnecting is driven there.
    };
  }

  function handleOpen(): void {
    if (shuttingDown) return;
    isOpen = true;
    attempt = 0;
    setState("open");
    const pending = queued.splice(0, queued.length);
    for (const msg of pending) {
      if (socket !== null) socket.send(JSON.stringify(msg));
    }
    opts.onOpen();
  }

  function handleClose(): void {
    if (shuttingDown) return;
    isOpen = false;
    setState("reconnecting");
    const delay = backoff[Math.min(attempt, backoff.length - 1)];
    attempt = Math.min(attempt + 1, backoff.length - 1);
    void setTimeout(() => {
      if (!shuttingDown) attach(createSocket(opts.url));
    }, delay);
  }

  function handleMessage(data: unknown): void {
    let frame: { readonly t: unknown } | null = null;
    try {
      frame = JSON.parse(typeof data === "string" ? data : String(data));
    } catch {
      return;
    }
    if (frame === null) return;
    if (typeof frame.t !== "string") return;
    opts.onMessage(frame as ServerMessage);
  }

  function send(msg: ClientMessage): void {
    if (isOpen && socket !== null) {
      socket.send(JSON.stringify(msg));
      return;
    }
    queued.push(msg);
    if (queued.length > MAX_QUEUED) queued.shift();
  }

  function close(): void {
    shuttingDown = true;
    if (socket !== null) socket.close();
    setState("closed");
  }

  attach(createSocket(opts.url));

  return { send, close };
}
