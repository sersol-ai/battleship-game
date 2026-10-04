# T-17 — WebSocket client + OnlineController

Role: coder · Depends on: T-09 (error-text.ts) · Size: L

## Goal

`GameController` implementation that plays through the server, with automatic reconnect + resume.

## Read first

- `src/client/controller.ts`, `src/shared/protocol.ts` (whole file)
- `src/client/error-text.ts`
- `docs/ARCHITECTURE.md` section 5 (for context only)

## Files

- create `src/client/ws-client.ts`, `src/client/ws-client.test.ts`
- create `src/client/online-controller.ts`, `src/client/online-controller.test.ts`
- create `src/client/fake-websocket.ts` (test helper, below)

## Spec — ws-client.ts

```ts
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
export function createWsClient(opts: WsClientOptions): WsClient;
```

- Starts connecting immediately → `onState("connecting")`. Open → reset backoff index, `onState("open")`,
  flush queued messages in order, then `onOpen()`.
- `send` while not open → queue (max 20; drop oldest).
- Message data: `JSON.parse` in try/catch; must be an object with string `t`, else ignored.
- Unexpected close → `onState("reconnecting")`, `setTimeout(backoff[i])`, `i = min(i+1, last)`, reconnect.
- `close()` → no more reconnects, close socket, `onState("closed")`.

## Spec — fake-websocket.ts (test helper)

`class FakeWebSocket implements WsLike` with `static instances: FakeWebSocket[]`, `sent: string[]`,
and helpers `serverOpen()`, `serverSend(msg: ServerMessage)`, `serverClose()` that set `readyState`
and call the handlers. Export `fakeFactory = (url: string) => new FakeWebSocket(url)`.

## Spec — online-controller.ts

```ts
import type { GameController } from "./controller.ts";
import type { RoomCode } from "../shared/protocol.ts";
import type { WsLike } from "./ws-client.ts";

export type OnlineIntent = { kind: "create" } | { kind: "join"; room: RoomCode };
export interface OnlineControllerOptions {
  intent: OnlineIntent;
  url?: string; // default `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`
  createSocket?: (url: string) => WsLike;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null; // default: sessionStorage (null if it throws)
}
export function createOnlineController(opts: OnlineControllerOptions): GameController;
```

- Session key `"battleship.session"` holds JSON `{room, token}`.
- Initial snapshot: `{view:null, mode:"online", connection:"connecting", opponent:"waiting", room:null, error:null}`.
- `onOpen`: if we have `{room, token}` in memory → send `resume`. Else if intent is join and storage has a
  session for the same room → send `resume` with the stored token. Else send `create` or `join` from intent.
- `joined` → remember room+token in memory and storage; `snapshot.room = room`.
- `state` → `view`, `error = null`. `opponent` → `opponent`.
- `error`: `error = errorText(code)`. If code is `BAD_TOKEN` or `ROOM_NOT_FOUND` while resuming:
  clear stored session and memory token; if the intent was join and this was a stored-session resume,
  send `join` once instead.
- `onState` → `connection`.
- `place` / `fire` / `rematch` → send the message. (Server validates; errors come back as `error`.)
- `dispose()` → send `leave`, clear stored session, `client.close()`, drop listeners.

## Tests

ws-client.test.ts (fake timers + FakeWebSocket): queue flushed on open; reconnect delays follow
backoff (500 then 1000); `close()` stops reconnecting; malformed JSON ignored.

online-controller.test.ts (fake timers + FakeWebSocket + in-memory storage object):

1. intent create → on open sends `{"t":"create"}`; after joined, room set and storage written.
2. state message → snapshot.view set; opponent message → snapshot.opponent.
3. Server closes → connection "reconnecting"; after reopen, controller sends `resume` with the token.
4. intent join with matching stored session → sends resume; server replies BAD_TOKEN → sends join.
5. error message → snapshot.error text non-empty; next state clears it.
6. dispose → last sent message is `leave`, storage cleared.

## Acceptance

`npm run format && npm run check` green.

## Out of scope

Lobby UI (T-18).

## Coder notes

- WsClient state machine matches the spec: connecting → open → reconnecting (backoff, last value repeats) → closed.
- Messages sent while the socket is down are queued (cap 20, oldest dropped) and replayed in order on the next open; `onOpen()` runs after the flush.
- `FakeWebSocket.instances` is static and shared by every test in a file, so tests compare instance-count deltas instead of absolute counts.
- `new WebSocket(url)` (DOM lib type) is not structurally assignable to `WsLike` (its `onopen` handler param is `Event`), so the default factory needs one `as WsLike` cast; runtime behaviour is unchanged.
- The default `storage` is read inside `try/catch`, so Node/vitest gets `null` instead of a ReferenceError; tests pass an explicit in-memory store.
- Resume bookkeeping: `resuming` means "the message we just sent was `resume`"; only then do BAD_TOKEN / ROOM_NOT_FOUND clear the session, and a stored-session resume re-sends `join` exactly once.
- `dispose()` sends `leave` before `client.close()` so the frame still reaches an open socket.
- `npm run check`: 17 files / 167 tests pass (4 ws-client + 6 online-controller).

## Questions for architect

## Review
