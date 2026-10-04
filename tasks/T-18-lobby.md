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

- `screens/lobby.ts` is complete and typechecks: `mountLobby(root, deps)` renders `screen-lobby` with `room-code` / `room-link` (`<input readonly>`) / `btn-copy-link` / `input-room-code` / `btn-join-room` / `btn-create-room` / `lobby-error` / `btn-back`; a 100 ms interval re-syncs the input (upper-case + `isRoomCode` → `btn-join-room.disabled`), so tests can set `input.value` and wait.
- Room block is hidden while `snapshot.error` is set, so the join form is the retry path; `btn-create-room` is disabled once a controller exists.
- `main.ts`: `stopGame()` disposes without navigating; `mountOnline()` re-mounts the lobby after create/join so it receives the controller; `/?room=` startup auto-joins; `exitToMenu` does `history.replaceState(null, "", "/")`.
- After the operator ran `npm install happy-dom`, `npm run check` is green: 18 files / 171 tests, 4 of them in `lobby.test.ts`.
- happy-dom ships its own type declarations, so `page.document.createElement("div")` is typed as happy-dom's `HTMLElement` and is NOT assignable to the DOM-lib `HTMLElement` that `mountLobby` takes. Fix (cast-free): the helper creates the root through the global `document` identifier, which is DOM-lib typed at compile time and happy-dom's object at runtime.
- happy-dom has no `Event` export and `dispatchEvent(new Event("click"))` throws "parameter 1 is not of type 'Event'"; its elements expose `click()`, which triggers the click event, so the tests call `btn.click()`.
- `package.json` / `package-lock.json` now carry the happy-dom dependency but are NOT in T-18's "Files" list, so they are left uncommitted here — a fresh clone will fail `npm run check` until the architect lands that dependency.
- The placement/battle branches of `mountOnline()` are comments: `screens/placement.ts` (T-11) and `screens/battle.ts` (T-12) do not exist in this branch, so `routeFor` can only ever return "lobby" here. The online game therefore still stalls in the lobby once joined.
- Board said T-18 was not ready (T-12 `todo`); I implemented only what does not need T-11/T-12 files.

## Questions for architect

1. **happy-dom had to be installed by the operator** (`npm install happy-dom`), which rewrote `package.json` + `package-lock.json`. Both files are outside T-18's "Files" list, so the dependency is NOT committed on this branch: `npm run check` is green locally but a fresh clone still fails TS2307 on `import { Window } from "happy-dom"`. Please land that dependency in `package.json` on `main` (or tell me to commit it) — otherwise T-18 cannot be merged green.
2. **T-18 depends on T-12, which is `todo`.** `main.ts` cannot mount placement/battle because `screens/placement.ts` and `screens/battle.ts` do not exist yet, so the "Placement rng for online games: `createRng(params.seed ^ 0x5bd1e995)`" bullet has nowhere to live — it belongs to the placement screen's deps, not `main.ts`. Should T-18 be re-run after T-11/T-12 merge, with that rng wired there?
3. `LobbyDeps.controller` is a plain value, so `main.ts` must re-mount the lobby after `onCreate`/`onJoin` for the new controller to show up (the spec says "then re-mount the lobby", so I followed that literally).

## Review
