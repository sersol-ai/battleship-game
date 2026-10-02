# T-18 — Lobby screen + online wiring

Role: coder · Depends on: T-12, T-16, T-17 · Size: M

## Goal

Create a room / join by code / join by link, then hand off to placement and battle via `routeFor`.

## Read first

- `docs/UI-CONTRACT.md` section "Lobby screen"
- `src/client/controller.ts`, `src/client/routing.ts`, `src/client/main.ts`
- exports of `src/client/online-controller.ts`, `src/shared/protocol.ts` (ROOM_CODE_*)

## Files

- create `src/client/screens/lobby.ts`, `src/client/screens/lobby.test.ts`
- modify `src/client/main.ts`
- modify `src/client/styles.css` (append `/* === lobby (T-18) === */`)

## Spec — screens/lobby.ts

```ts
import type { GameController } from "../controller.ts";
export interface LobbyDeps {
  /** The active online controller, or null if none started yet. */
  controller: GameController | null;
  onCreate(): void; // main creates an OnlineController with intent create
  onJoin(room: string): void; // main creates one with intent join
  onBack(): void; // main disposes the controller and shows the menu
}
export function mountLobby(root: HTMLElement, deps: LobbyDeps): () => void;
```

Layout `<section data-testid="screen-lobby">`:

- **No controller**: "Create room" (`btn-create-room`); a join form: `input-room-code`
  (maxlength 6, auto upper-case on input, `autocomplete="off"`), `btn-join-room` (disabled until the
  value is a valid room code — reuse `isRoomCode` from `src/shared/guards.ts`); `lobby-error` (empty); `btn-back`.
- **With controller** (subscribe): if `snapshot.room` is set: `room-code` (big text), `room-link`
  (`<input readonly>` value `${location.origin}/?room=${room}`), `btn-copy-link`
  (`navigator.clipboard.writeText`, ignore failures, button text "Copied!" for 2 s), and text
  "Waiting for opponent…" (or "Opponent left — share the link again" when `opponent === "left"`).
  Without room yet: "Connecting…". `snapshot.error` → `lobby-error` text, and show the join form
  again so the user can retry. `btn-back` always present.

## Spec — main.ts changes

- Route `"lobby"` → `mountLobby(app, { controller, onCreate, onJoin, onBack: exitToMenu })`.
- Menu `onPlayOnline` → `mount("lobby")` with `controller = null`.
- `onCreate` → `startGame(createOnlineController({ intent: { kind: "create" } }))`, then re-mount the lobby
  so it receives the controller. Same for `onJoin(room)` with `{ kind: "join", room }`.
- A failed join (error + `view === null`): stay in lobby; the lobby's retry join must dispose the
  failed controller first (`exitToMenu` logic without navigating — add a small `stopGame()` helper).
- `params.room` set at startup → behave as `onJoin(params.room)` immediately.
- Placement `rng` for online games: same as AI (`createRng(params.seed ^ 0x5bd1e995)`).
- `exitToMenu` must also remove `?room=` from the URL (`history.replaceState(null, "", "/")`).

## Tests (lobby.test.ts) — happy-dom + fake controller

1. No controller: join button disabled for "ABC", enabled for "k7pq2m" (input shows "K7PQ2M"); click → onJoin("K7PQ2M").
2. Create click → onCreate called.
3. Controller snapshot with room "K7PQ2M" → room-code text and room-link value contain it.
4. Snapshot with error → lobby-error has text.

## Acceptance

- `npm run format && npm run check` green.
- Manual: `npm run build && npm start`; two browser windows on http://localhost:8080 → create in one,
  open the link in the other, place ships in both, play to the end, rematch.

## Out of scope

Spectators, chat, matchmaking.

## Coder notes

## Questions for architect

## Review
