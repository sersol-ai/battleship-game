# T-09 — LocalController (play vs AI)

Role: coder · Depends on: T-04, T-06, T-07 · Size: M

## Goal

Implement `GameController` for a human (p1) vs the computer (p2), fully in the browser.

## Read first

- `src/client/controller.ts` (the interface you implement)
- `src/shared/types.ts`, `src/shared/protocol.ts` (ProtocolError type only)
- exports of `src/shared/{rng,match,view,placement,ai}.ts`

## Files

- create `src/client/error-text.ts`
- create `src/client/local-controller.ts`
- create `src/client/local-controller.test.ts`

## Spec — error-text.ts

```ts
import type { ProtocolError } from "../shared/protocol.ts";
/** Short English sentence for every ProtocolError code (use a Record<ProtocolError, string> so TS forces completeness). */
export function errorText(code: ProtocolError): string;
```

## Spec — local-controller.ts

```ts
import type { GameController } from "./controller.ts";
import type { AiDifficulty } from "../shared/types.ts";
export interface LocalControllerOptions {
  difficulty: AiDifficulty;
  seed: number;
  aiDelayMs: number;
}
export function createLocalController(opts: LocalControllerOptions): GameController;
```

Behaviour:

- `rng = createRng(opts.seed)`; `ai = createAi(opts.difficulty, rng)`.
- New match (at creation and on rematch): `state = createMatch("p1")` (human always starts), then
  immediately apply `place` for p2 with `randomFleet(rng)`.
- Snapshot: `{ view: toPlayerView(state, "p1"), mode: "ai", connection: "open", opponent: "connected", room: null, error }`.
  Build a new snapshot object on every change; `getSnapshot()` returns the latest one.
- `subscribe(l)`: calls `l(snapshot)` synchronously, then on every change; returns unsubscribe.
- `place(fleet)`: `applyAction({type:"place", player:"p1", fleet})`. Error → `error = errorText(code)`, notify.
  Success → `error = null`, notify, then `scheduleAi()`.
- `fire(coord)`: `applyAction` as p1; error → set error + notify; success → clear error, notify, `scheduleAi()`.
- `scheduleAi()`: if no timer pending and `phase === "playing"` and `turn === "p2"`:
  `setTimeout(aiDelayMs)` → `coord = ai.nextShot(toPlayerView(state, "p2").enemyGrid)` → apply as p2
  (an error here is a bug: `throw`) → notify → `scheduleAi()` again (handles extra shots).
- `rematch()`: ignored unless `phase === "finished"`; else new match (see above), error null, notify.
- `dispose()`: clear timer, drop all listeners; later calls to any method do nothing.

## Tests (local-controller.test.ts) — `vi.useFakeTimers()`, seed 7, aiDelayMs 100

1. Initial snapshot: phase placing, myPlaced false, enemyPlaced true, mode "ai".
2. `place(FLEET_A)` → phase playing, isMyTurn true.
3. `fire({x:0,y:0})` → isMyTurn false; `vi.advanceTimersByTime(100)` → isMyTurn true and
   `lastShot.by === "p2"`.
4. `fire` when not my turn → `snapshot.error` is a non-empty string; state unchanged.
5. Invalid fleet → error set; valid place afterwards clears it.
6. Full game: loop — fire at the next cell in row-major order that is `"unknown"` in enemyGrid, then
   advance timers — until phase finished. Winner is set. `rematch()` → phase placing, myPlaced false.
7. `dispose()` during a pending AI timer → advancing timers calls no listener.
8. Same seed → same AI shot sequence across two controllers (compare lastShot after each turn).

## Acceptance

`npm run format && npm run check` green.

## Out of scope

DOM, screens.

- Created `src/client/error-text.ts` mapping every `ProtocolError` code to a readable English string.
- Created `src/client/local-controller.ts` implementing `GameController` for human-vs-AI gameplay: manages MatchState, handles placing/firing/rematch/dispose, schedules AI turns with setTimeout, notifies subscribers via snapshot pattern.
- Created `src/client/local-controller.test.ts` with 8 tests: initial snapshot, placing transitions, AI scheduling, turn-violation errors, fleet validation, full game-to-finished loop, dispose cleanup, deterministic seed replay.
- **State mutation bug**: `applyAction` returns `Result<MatchState>` but does NOT mutate in place. Forgetting `state = result.value` after fire/place silently keeps old state. Discovered when fire seemed to do nothing.
- **Test loop stale snapshot**: Original full-game test hung with SIGABRT (OOM). Root cause: `snapshots.at(-1)` could be stale if subscribe wasn't called before initial fire. Fixed by ensuring subscribe is always called first.
- All 119 tests pass, typecheck clean, formatting green.

## Questions for architect

## Review
