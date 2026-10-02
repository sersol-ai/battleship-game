import { createAi, type Ai } from "../shared/ai.ts";
import { applyAction, createMatch } from "../shared/match.ts";
import { randomFleet } from "../shared/placement.ts";
import { createRng } from "../shared/rng.ts";
import { toPlayerView } from "../shared/view.ts";
import type { AiDifficulty, Coord, Fleet, MatchState, PlayerId, Rng } from "../shared/types.ts";
import type { ControllerSnapshot, GameController } from "./controller.ts";
import { errorText } from "./error-text.ts";

export interface LocalControllerOptions {
  difficulty: AiDifficulty;
  seed: number;
  aiDelayMs: number;
}

export function createLocalController(opts: LocalControllerOptions): GameController {
  const rng: Rng = createRng(opts.seed);
  const ai: Ai = createAi(opts.difficulty, rng);

  let timerId: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let state: MatchState;
  let snapshot: ControllerSnapshot;
  const listeners: Array<(snap: ControllerSnapshot) => void> = [];

  function buildSnapshot(err: string | null = null): void {
    snapshot = {
      view: toPlayerView(state, "p1" as PlayerId),
      mode: "ai",
      connection: "open" as const,
      opponent: "connected" as const,
      room: null,
      error: err,
    };
  }

  function notifyAll(): void {
    for (const l of listeners) {
      l(snapshot);
    }
  }

  function createNewMatch(): void {
    state = createMatch("p1" as PlayerId);
    // Place opponent AI fleet immediately
    const aiFleet = randomFleet(rng);
    const result = applyAction(state, {
      type: "place",
      player: "p2" as PlayerId,
      fleet: aiFleet,
    });
    if (!result.ok) {
      throw new Error(`Unexpected AI placement error: ${result.error}`);
    }
    state = result.value;
    buildSnapshot(null);
  }

  function scheduleAi(): void {
    if (timerId !== null || disposed) return;
    if (state.phase !== "playing" || state.turn !== "p2") return;

    timerId = setTimeout(() => {
      timerId = null;
      if (disposed) return;
      if (state.phase !== "playing" || state.turn !== "p2") return;

      const enemyGrid = toPlayerView(state, "p2" as PlayerId).enemyGrid;
      const coord = ai.nextShot(enemyGrid);

      const result = applyAction(state, {
        type: "fire",
        player: "p2" as PlayerId,
        coord,
      });
      if (!result.ok) {
        throw new Error(`AI shot error: ${result.error}`);
      }
      state = result.value;

      buildSnapshot(null);
      notifyAll();

      // Handle cascading (extra shots from sunk ship hits)
      scheduleAi();
    }, opts.aiDelayMs);
  }

  // -- Initialise --
  createNewMatch();
  notifyAll();

  return {
    subscribe(listener: (snap: ControllerSnapshot) => void): () => void {
      if (disposed) return () => {};
      listener(snapshot);
      listeners.push(listener);
      return () => {
        const idx = listeners.indexOf(listener);
        if (idx !== -1) {
          listeners.splice(idx, 1);
        }
      };
    },

    getSnapshot(): ControllerSnapshot {
      return snapshot;
    },

    place(fleet: Fleet): void {
      if (disposed) return;

      const result = applyAction(state, {
        type: "place",
        player: "p1" as PlayerId,
        fleet,
      });

      if (!result.ok) {
        buildSnapshot(errorText(result.error));
        notifyAll();
        return;
      }

      state = result.value;
      buildSnapshot(null);
      notifyAll();
      scheduleAi();
    },

    fire(coord: Coord): void {
      if (disposed) return;

      const result = applyAction(state, {
        type: "fire",
        player: "p1" as PlayerId,
        coord,
      });

      if (!result.ok) {
        buildSnapshot(errorText(result.error));
        notifyAll();
        return;
      }

      state = result.value;
      buildSnapshot(null);
      notifyAll();
      scheduleAi();
    },

    rematch(): void {
      if (disposed) return;
      createNewMatch();
      notifyAll();
    },

    dispose(): void {
      disposed = true;
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      listeners.length = 0;
    },
  };
}
