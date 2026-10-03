import { describe, expect, it } from "vitest";
import { mountLobby } from "./lobby.ts";
import type { ControllerSnapshot, GameController } from "../controller.ts";
import type { PlayerView } from "../../shared/types.ts";
import { Window } from "happy-dom";

const VIEW: PlayerView = {
  me: "p1",
  phase: "placing",
  isMyTurn: false,
  winner: null,
  myPlaced: false,
  enemyPlaced: false,
  myGrid: [["empty"]],
  enemyGrid: [["unknown"]],
  enemyShipsRemaining: [],
  myShipsRemaining: [],
  lastShot: null,
};

function sleep(ms: number): Promise<void> {
  return new Promise((done) => {
    void setTimeout(done, ms);
  });
}

// lobby.ts uses the browser globals (`document`, `location`), so the tests publish
// the happy-dom page on globalThis before mounting.
function newPage(): { root: HTMLElement; close: () => void } {
  const page = new Window({ url: "http://localhost:8080/" });
  Object.assign(globalThis, { document: page.document, location: page.window.location });
  return { root: page.document.createElement("div"), close: () => page.close() };
}

function fakeController(snapshot: ControllerSnapshot): GameController {
  return {
    subscribe: (listener) => {
      listener(snapshot);
      return () => {};
    },
    getSnapshot: () => snapshot,
    place: () => {},
    fire: () => {},
    rematch: () => {},
    dispose: () => {},
  };
}

describe("lobby screen", () => {
  it("join form validates the room code", async (): Promise<void> => {
    const page = newPage();
    const joined: string[] = [];
    const unmount = mountLobby(page.root, {
      controller: null,
      onCreate: () => {},
      onJoin: (room) => {
        joined.push(room);
      },
      onBack: () => {},
    });
    const input = page.root.querySelector("[data-testid=input-room-code]") as HTMLInputElement;
    const joinBtn = page.root.querySelector("[data-testid=btn-join-room]") as HTMLButtonElement;
    input.value = "ABC";
    await sleep(150);
    expect(joinBtn.disabled).toBe(true);
    input.value = "k7pq2m";
    await sleep(150);
    expect(input.value).toBe("K7PQ2M");
    expect(joinBtn.disabled).toBe(false);
    joinBtn.dispatchEvent(new Event("click"));
    expect(joined).toEqual(["K7PQ2M"]);
    unmount();
    page.close();
  });

  it("create room button calls onCreate", async (): Promise<void> => {
    const page = newPage();
    const created: string[] = [];
    const unmount = mountLobby(page.root, {
      controller: null,
      onCreate: () => {
        created.push("create");
      },
      onJoin: (room) => {
        void room;
      },
      onBack: () => {},
    });
    const createBtn = page.root.querySelector("[data-testid=btn-create-room]") as HTMLButtonElement;
    createBtn.dispatchEvent(new Event("click"));
    expect(created).toEqual(["create"]);
    unmount();
    page.close();
  });

  it("a controller with a room shows the code and the share link", async (): Promise<void> => {
    const page = newPage();
    const snapshot: ControllerSnapshot = {
      view: VIEW,
      mode: "online",
      connection: "open",
      opponent: "waiting",
      room: "K7PQ2M",
      error: null,
    };
    const unmount = mountLobby(page.root, {
      controller: fakeController(snapshot),
      onCreate: () => {},
      onJoin: (room) => {
        void room;
      },
      onBack: () => {},
    });
    const roomCode = page.root.querySelector("[data-testid=room-code]") as HTMLElement;
    const linkInput = page.root.querySelector("[data-testid=room-link]") as HTMLInputElement;
    expect(roomCode.textContent).toContain("K7PQ2M");
    expect(linkInput.value).toContain("K7PQ2M");
    unmount();
    page.close();
  });

  it("a snapshot error lands in lobby-error", async (): Promise<void> => {
    const page = newPage();
    const snapshot: ControllerSnapshot = {
      view: null,
      mode: "online",
      connection: "open",
      opponent: "waiting",
      room: null,
      error: "Room not found",
    };
    const unmount = mountLobby(page.root, {
      controller: fakeController(snapshot),
      onCreate: () => {},
      onJoin: (room) => {
        void room;
      },
      onBack: () => {},
    });
    const errorEl = page.root.querySelector("[data-testid=lobby-error]") as HTMLElement;
    expect(errorEl.textContent).toContain("Room not found");
    unmount();
    page.close();
  });
});
