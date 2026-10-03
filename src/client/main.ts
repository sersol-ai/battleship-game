import "./styles.css";
import { readParams } from "./params.ts";
import { routeFor } from "./routing.ts";
import type { AiDifficulty } from "../shared/types.ts";
import type { GameController } from "./controller.ts";
import { createOnlineController } from "./online-controller.ts";
import type { OnlineIntent } from "./online-controller.ts";
import { mountMenu } from "./screens/menu.ts";
import type { MenuDeps } from "./screens/menu.ts";
import { mountLobby } from "./screens/lobby.ts";

const appEl = document.getElementById("app")!;

let controller: GameController | null = null;
let unmountScreen: () => void = () => {};

// Dispose the active controller without navigating (used by the lobby's retry).
function stopGame(): void {
  if (controller !== null) {
    controller.dispose();
    controller = null;
  }
}

function startGame(intent: OnlineIntent): void {
  stopGame();
  controller = createOnlineController({ intent });
}

function mountOnline(): void {
  if (controller === null) {
    unmountScreen();
    unmountScreen = mountLobby(appEl, {
      controller: null,
      onCreate(): void {
        startGame({ kind: "create" });
        mountOnline();
      },
      onJoin(room: string): void {
        startGame({ kind: "join", room });
        mountOnline();
      },
      onBack(): void {
        exitToMenu();
      },
    });
    return;
  }

  const route = routeFor(controller.getSnapshot());
  if (route === "lobby") {
    // Re-mount so the lobby receives the controller (room code, link, status).
    unmountScreen();
    unmountScreen = mountLobby(appEl, {
      controller,
      onCreate(): void {
        startGame({ kind: "create" });
        mountOnline();
      },
      onJoin(room: string): void {
        startGame({ kind: "join", room });
        mountOnline();
      },
      onBack(): void {
        exitToMenu();
      },
    });
    return;
  }

  // "placement" and "battle" belong to screens/placement.ts (T-11) and
  // screens/battle.ts (T-12); those files do not exist in this branch yet.
}

function exitToMenu(): void {
  stopGame();
  history.replaceState(null, "", "/");
  unmountScreen();
  unmountScreen = mountMenu(appEl, menuDeps);
}

const menuDeps: MenuDeps = {
  onPlayAi(difficulty: AiDifficulty): void {
    console.log("starting AI game, difficulty:", difficulty);
  },
  onPlayOnline(): void {
    mountOnline();
  },
};

function main(): void {
  const params = readParams(location.search, Math.floor(Math.random() * 2 ** 32));
  if (params.room !== null) {
    // Opening /?room=CODE auto-joins that room.
    startGame({ kind: "join", room: params.room });
  }
  mountOnline();
}

main();
