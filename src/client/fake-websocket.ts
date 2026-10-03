// Test helper for ws-client / online-controller tests: a stand-in for the browser
// WebSocket that the tests drive by hand (no real sockets, no real server).

import type { WsLike } from "./ws-client.ts";
import type { ServerMessage } from "../shared/protocol.ts";

export class FakeWebSocket implements WsLike {
  static instances: FakeWebSocket[] = [];

  readonly url: string;
  readyState: number;
  sent: string[];
  onopen: ((ev: unknown) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev: unknown) => void) | null;

  constructor(url: string) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this.onerror = null;
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  // Client-initiated close: no "close" event fires (the browser sends none either).
  close(): void {
    this.readyState = 3;
  }

  serverOpen(): void {
    this.readyState = 1;
    this.onopen?.(undefined);
  }

  serverSend(msg: ServerMessage): void {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }

  serverClose(): void {
    this.readyState = 3;
    this.onclose?.(undefined);
  }
}

export const fakeFactory = (url: string) => new FakeWebSocket(url);
