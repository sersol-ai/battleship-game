# Architecture

Browser Battleship: play against the computer (offline, in-browser) or against a friend online
(room code / share link). One TypeScript codebase, one Node process, one Docker image.

## 1. Decisions (settled — do not re-open without the architect)

| #   | Decision                                                                                                                         | Why                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| D1  | TypeScript everywhere, `strict` + `noUncheckedIndexedAccess`                                                                     | Shared engine runs in browser and server; types are the contracts between small tasks.                  |
| D2  | No UI framework. Vanilla TS + DOM, one module per screen/component                                                               | Zero framework knowledge needed; small files; tiny bundle.                                              |
| D3  | Pure game engine in `src/shared` — immutable data, pure functions, seeded RNG                                                    | Unit-testable, deterministic, reused by LocalController and server.                                     |
| D4  | Server is authoritative for online games and sends the **full** `PlayerView` after every change                                  | No incremental sync bugs; cheating impossible (opponent ships never leave the server until game over).  |
| D5  | Online state is **in-memory only**. No database                                                                                  | Rooms are short-lived. A restart drops running games — accepted.                                        |
| D6  | One container: Node 22 serves static client (`dist/client`) + WebSocket `/ws` + `GET /healthz` on port 8080                      | Matches portainer-iac: one stack, one host port, Traefik file route.                                    |
| D7  | Runtime dependency: only `ws`. Dev: vite, vitest, typescript, esbuild, prettier (+ @playwright/test added by QA)                 | Minimal surface for small-context coders.                                                               |
| D8  | Rules: 10×10, fleet 5/4/3/3/2, ships may NOT touch (incl. diagonal), turns alternate. All in `src/shared/rules.ts`               | Flip `ALLOW_ADJACENT_SHIPS` / `EXTRA_SHOT_ON_HIT` there to change rules; engine must honour both flags. |
| D9  | Image built by GitHub Actions → `ghcr.io/sersol-ai/battleship-game:<semver>`; deployed by portainer-iac stack pinned to that tag | portainer-iac cannot `build:` (see its CLAUDE.md). Renovate there can bump the tag.                     |
| D10 | Determinism hooks for tests: URL `?seed=<int>` seeds all client RNG, `?aidelay=<ms>` sets AI think delay (default 600)           | Playwright e2e must be reproducible.                                                                    |

## 2. Directory layout

```
src/
  shared/                 pure engine — no DOM, no Node, no Math.random
    types.ts              CONTRACT (architect-owned)
    rules.ts              CONTRACT
    protocol.ts           CONTRACT — WebSocket messages
    rng.ts                T-01  seeded RNG (mulberry32) + helpers
    board.ts              T-02  geometry, fleet validation (+ test-fixtures.ts)
    shots.ts              T-03  firing at a board, sunk detection
    placement.ts          T-04  random valid fleet
    match.ts              T-05  match reducer (state machine for 2 players)
    view.ts               T-06  toPlayerView() — redacted per-player view
    ai.ts                 T-07  computer opponent
    guards.ts             T-13  runtime validation of untrusted JSON
  client/
    index.html            T-08
    styles.css            T-08 (+ sections appended by T-10/11/12/18)
    main.ts               T-08  bootstrap + screen router (extended by T-11/12/18)
    params.ts             T-08  reads ?seed / ?aidelay / ?room
    routing.ts            T-08  routeFor(snapshot) → which screen
    controller.ts         CONTRACT — GameController interface
    error-text.ts         T-09  ProtocolError → user text
    local-controller.ts   T-09  vs AI
    ui/grid.ts            T-10  reusable 10x10 grid component
    screens/menu.ts       T-08
    screens/placement.ts  T-11
    screens/battle.ts     T-12
    ws-client.ts          T-17  reconnecting socket wrapper
    online-controller.ts  T-17  vs human over WebSocket
    screens/lobby.ts      T-18
  server/
    static.ts             T-14  static file handler
    rooms.ts              T-15  RoomManager (pure logic, no sockets)
    app.ts                T-16  http + /healthz + ws wiring (startServer)
    index.ts              T-16  process entry (env, signals)
e2e/                      QA — Playwright specs (Q-01..Q-03)
docs/                     ARCHITECTURE.md (this), UI-CONTRACT.md
tasks/                    BOARD.md + one file per task (+ bugs/)
.pi/                      pi harness: prompts (slash commands) + skills
```

Import rule (enforced in review):

```
client/*  → may import shared/*           never server/*
server/*  → may import shared/*           never client/*
shared/*  → imports only shared/*         never DOM/Node globals
```

Imports use explicit `.ts` extensions: `import { x } from "./board.ts";`

## 3. Engine (src/shared)

Data flows one way: `Fleet` → `Board` → `MatchState` → `PlayerView`.

- **Coordinates**: `{x, y}`, x = column, y = row, 0-based. Grids are `grid[y][x]`.
- **Immutability**: functions return new objects; never mutate arguments.
- **Errors**: expected failures return `Result<T, E>` (`{ok:false, error}`), never throw. Throwing
  is only for programmer errors (impossible states).
- **Randomness**: only through `Rng` from `rng.ts`. `createRng(seed)` for determinism.

Match lifecycle (`match.ts`):

```
createMatch(firstTurn) ─► phase "placing"
   place(p1) + place(p2) (any order) ─► phase "playing", turn = firstTurn
   fire(turn player) ─► miss: turn passes | hit/sunk: turn passes unless EXTRA_SHOT_ON_HIT
   last ship of a player sunk ─► phase "finished", winner set
```

## 4. Client

Screens (exactly one visible at a time, rendered into `#app`):

```
menu ──"Play vs computer"──► placement ──ready──► battle ──game over──► (rematch → placement) | menu
  └───"Play online"──► lobby ──room joined──► placement ──► battle ...
```

- Screen module shape: `export function mountX(root: HTMLElement, deps): () => void` — renders into
  `root`, returns an unmount function that removes listeners/timers.
- `main.ts` owns navigation and the current `GameController`; screens call callbacks passed in
  `deps` (e.g. `onReady`, `onExit`) — screens never import other screens.
- Placement and battle screens read everything from `controller.subscribe(...)` snapshots.
- After `place()`, the placement screen shows "Waiting for opponent…" until
  `view.phase === "playing"`; main.ts then switches to battle.
- Every interactive element has the `data-testid` from `docs/UI-CONTRACT.md`. That file is the
  contract between coders and QA.
- Styling: plain CSS in `styles.css`, CSS variables for colours, must work at 360px width (grids
  stack vertically below 720px).

## 5. Server

- `node:http` server on `PORT` (default 8080). Routes:
  - `GET /healthz` → `200 {"ok":true,"rooms":<n>}`
  - `GET /ws` with Upgrade → WebSocket (`ws` package, `maxPayload: MAX_MESSAGE_BYTES`)
  - anything else → static file from `dist/client`, unknown paths → `index.html`
- `RoomManager` (rooms.ts) is pure logic with injected `send(playerConnId, ServerMessage)` and `now()`
  so it is unit-testable without sockets.
- Every incoming frame: parse JSON → `isClientMessage()` (guards.ts) → RoomManager. Invalid → `error`
  `BAD_MESSAGE`. Never trust client data; never crash the process on bad input.
- Limits: max 500 rooms (`SERVER_BUSY`), ping every 30s, terminate sockets that miss a pong.
- Logging: one JSON line per event to stdout (`{"ts":…,"event":"room_created","room":"…"}`); no
  logging of full messages.

## 6. Hosting (portainer-iac)

- Image: `ghcr.io/sersol-ai/battleship-game:<version>` (public package), built by
  `.github/workflows/release.yml` on git tag `v*`.
- Stack: `portainer-iac/battleship/docker-compose.yml`, image pinned by tag+digest in the
  compose file (NOT in `stack.env` — Portainer's poller doesn't re-read stack.env).
- Host port `8090` → container `8080`. Traefik route `battleship.sonic.wtf` →
  `http://10.0.99.200:8090` (WebSocket works through Traefik with no extra config).
  Every `dynamic-config.yml` change needs a `TRAEFIK_RESTART_TOKEN` bump in the same push.
- No auth, no persistent volume. Healthcheck: `wget -qO- http://127.0.0.1:8080/healthz`.
- Deploy once with `deploy_stack_git` (never `update_stack`). Tracked issue-first in portainer-iac.
