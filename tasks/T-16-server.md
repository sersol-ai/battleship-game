# T-16 — Server: HTTP + WebSocket wiring

Role: coder · Depends on: T-13, T-14, T-15 · Size: M

## Goal

The production Node process: static files, `/healthz`, `/ws` → RoomManager.

## Read first

- `docs/ARCHITECTURE.md` section 5
- `src/shared/protocol.ts` (constants), exports of `src/shared/guards.ts`, `src/shared/rng.ts`
- exports of `src/server/static.ts`, `src/server/rooms.ts`

## Files

- create `src/server/app.ts`
- create `src/server/index.ts`
- create `src/server/app.test.ts`

## Spec — app.ts

```ts
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
export function startServer(opts: ServerOptions): Promise<RunningServer>;
```

- `http.createServer`: `GET /healthz` → 200 `application/json` `{"ok":true,"rooms":<roomCount>}`;
  everything else → `createStaticHandler(staticDir)`.
- `new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES })` (`import { WebSocketServer } from "ws"`).
  On `upgrade`: pathname `/ws` → `wss.handleUpgrade(...)` then `wss.emit("connection", ws, req)`; other paths → `socket.destroy()`.
- RoomManager deps: `send` = look up socket by ConnId, send `JSON.stringify(msg)` if `readyState === OPEN`;
  `now: Date.now`; `rng: createRng(crypto.randomInt(2 ** 32))` (`import crypto from "node:crypto"`);
  `newToken: () => crypto.randomBytes(16).toString("hex")`; `log` = JSON line to stdout
  `console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...data }))`.
- On connection: `conn = crypto.randomUUID()`, store in `Map<ConnId, WebSocket>`, `isAlive = true`.
  - `message (data, isBinary)`: binary → send error BAD_MESSAGE; else `parseClientMessage(data.toString())`;
    null → error BAD_MESSAGE; else `manager.handleMessage(conn, msg)`. Wrap in try/catch: an exception
    is logged (`event: "handler_error"`) and never crashes the process.
  - `pong` → `isAlive = true`. `close` → delete from map, `manager.handleDisconnect(conn)`.
  - `error` → log only.
- Ping interval: for each socket, if `!isAlive` → `terminate()`, else `isAlive = false; ping()`.
- Sweep interval: `manager.sweep()`.
- Log `server_started` with port.

## Spec — index.ts

```ts
const port = Number(process.env.PORT ?? 8080);
const staticDir = process.env.STATIC_DIR ?? path.resolve(import.meta.dirname, "../client");
```

Start the server; on `SIGTERM`/`SIGINT` → `await server.close()` then `process.exit(0)`;
force `process.exit(1)` if not closed within 5 s.

## Tests (app.test.ts) — real server on port 0, `ws` package as client

Helper `connect(port)` → opens `new WebSocket(\`ws://127.0.0.1:${port}/ws\`)`and collects parsed
messages; helper`waitFor(client, t)`resolves with the next message of type t (timeout 2 s).
Use a temp static dir with an`index.html`.

1. `GET /healthz` → `{ok:true, rooms:0}`.
2. A sends create → gets joined; B joins with that code → both get opponent connected; healthz rooms 1.
3. Sending `"garbage"` → error BAD_MESSAGE, socket still open (send create afterwards works).
4. Upgrade to `/other` fails (client gets an error/close).
5. Closing B → A gets opponent disconnected.
6. `close()` resolves and the port is no longer accepting connections.

## Acceptance

- `npm run format && npm run check` green.
- `npm run build && npm start` → http://localhost:8080 shows the menu; `curl localhost:8080/healthz` works.

## Out of scope

Client networking.

## Coder notes

- app.ts/index.ts follow the spec: healthz, static fallback, `/ws` upgrade only, ping + sweep intervals, `close()` clears intervals, terminates sockets, closes the http server.
- `startServer` had to be `async` — a plain function returning an object literal is rejected (TS2353) against `Promise<RunningServer>`.
- @types/ws declares `on(...)` listeners with an implicit `this` first param, so `(data, isBinary)` / `(error)` bind correctly; verified against ws's own `emit` calls.
- `ClientMessage` carries no fleet on create/join — placement is a separate `place` message, so tests go create → place → join → place.
- Tests use `describe("server", () => { it(...) })`; a bare `async` describe registers an empty suite in this vitest version.
- Room-code regex rebuilt from `ROOM_CODE_ALPHABET` (A–Z minus I/O, plus 2–9).
- Branch merges `task/T-14` + `task/T-15` so the dependency code compiles; T-13 was already on main.
- `npm run check` green: 15 files / 157 tests.

## Questions for architect

## Review
