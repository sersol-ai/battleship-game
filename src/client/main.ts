import "./styles.css";
import { readParams } from "./params.ts";
import { routeFor } from "./routing.ts";
import type { Route } from "./routing.ts";
import type { AiDifficulty } from "../shared/types.ts";
import type { GameController } from "./controller.ts";
import { createLocalController } from "./local-controller.ts";
import { createOnlineController } from "./online-controller.ts";
import type { OnlineIntent } from "./online-controller.ts";
import { mountMenu } from "./screens/menu.ts";
import type { MenuDeps } from "./screens/menu.ts";
import { mountLobby } from "./screens/lobby.ts";
import type { LobbyDeps } from "./screens/lobby.ts";
import { mountPlacement } from "./screens/placement.ts";
import { mountBattle } from "./screens/battle.ts";
import type { BattleDeps } from "./screens/battle.ts";
import type { PlacementDeps } from "./screens/placement.ts";
import { createRng } from "../shared/rng.ts";

const appEl = document.getElementById("app")!;
const params = readParams(location.search, Math.floor(Math.random() * 2 ** 32));

let controller: GameController | null = null;
let unsubscribe: () => void = () => {};
let unmountScreen: () => void = () => {};
let route: Route | "menu" = "menu";

function mountBattleScreen(): void {
  if (controller === null) {
    return;
  }
  const deps: BattleDeps = { controller, onExit: exitToMenu };
  unmountScreen = mountBattle(appEl, deps);
}

function lobbyDeps(active: GameController | null): LobbyDeps {
  return {
    controller: active,
    onCreate(): void {
      startGame(createOnlineController({ intent: { kind: "create" } }));
      mountScreen("lobby");
    },
    onJoin(room: string): void {
      startGame(createOnlineController({ intent: { kind: "join", room } }));
      mountScreen("lobby");
    },
    onBack(): void {
      exitToMenu();
    },
  };
}

function mountScreen(next: Route | "menu"): void {
  unmountScreen();
  route = next;
  if (next === "menu") {
    unmountScreen = mountMenu(appEl, menuDeps);
    return;
  }
  if (next === "placement" && controller !== null) {
    const deps: PlacementDeps = {
      controller,
      rng: createRng(params.seed ^ 0x5bd1e995),
      onExit: exitToMenu,
    };
    unmountScreen = mountPlacement(appEl, deps);
    return;
  }
  if (next === "battle") {
    mountBattleScreen();
    return;
  }
  unmountScreen = mountLobby(appEl, lobbyDeps(controller));
}

function startGame(next: GameController): void {
  unsubscribe();
  controller?.dispose();
  controller = next;
  unsubscribe = next.subscribe((snapshot) => {
    const next2 = routeFor(snapshot);
    if (next2 !== route) {
      mountScreen(next2);
    }
  });
}

function exitToMenu(): void {
  unsubscribe();
  controller?.dispose();
  controller = null;
  // Opening /?room=CODE must not survive a trip back to the menu.
  history.replaceState(null, "", "/");
  mountScreen("menu");
}

const menuDeps: MenuDeps = {
  onPlayAi(difficulty: AiDifficulty): void {
    startGame(
      createLocalController({
        difficulty,
        seed: params.seed,
        aiDelayMs: params.aiDelayMs,
      }),
    );
  },
  onPlayOnline(): void {
    mountScreen("lobby");
  },
};

function main(): void {
  if (params.room !== null) {
    // Opening /?room=CODE auto-joins that room.
    startGame(createOnlineController({ intent: { kind: "join", room: params.room } }));
    return;
  }
  mountScreen("menu");
}

main();
