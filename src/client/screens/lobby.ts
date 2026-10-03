import type { ControllerSnapshot, GameController } from "../controller.ts";
import type { OpponentStatus, RoomCode } from "../../shared/protocol.ts";
import { isRoomCode } from "../../shared/guards.ts";

export interface LobbyDeps {
  /** The active online controller, or null if none started yet. */
  controller: GameController | null;
  onCreate(): void; // main creates an OnlineController with intent create
  onJoin(room: string): void; // main creates one with intent join
  onBack(): void; // main disposes the controller and shows the menu
}

const COPY_BUTTON_TEXT = "Copy link";
const COPIED_TEXT = "Copied!";
const COPIED_MS = 2_000;
const SYNC_MS = 100;

function shareLink(room: RoomCode): string {
  return `${location.origin}/?room=${room}`;
}

function copyToClipboard(text: string): void {
  try {
    void navigator.clipboard.writeText(text).catch(() => {});
  } catch {
    // Clipboard is unavailable or denied; the link is already visible on screen.
  }
}

export function mountLobby(root: HTMLElement, deps: LobbyDeps): () => void {
  const host = document.createElement("section");
  host.setAttribute("data-testid", "screen-lobby");
  host.innerHTML = `
    <h1>Online lobby</h1>
    <p data-testid="lobby-status"></p>
    <div data-testid="room-code"></div>
    <input data-testid="room-link" type="text" readonly autocomplete="off"></input>
    <button data-testid="btn-copy-link" class="btn">${COPY_BUTTON_TEXT}</button>
    <input data-testid="input-room-code" type="text" maxlength="6" autocomplete="off"></input>
    <button data-testid="btn-join-room" class="btn" disabled>Join room</button>
    <button data-testid="btn-create-room" class="btn">Create room</button>
    <p data-testid="lobby-error"></p>
    <button data-testid="btn-back" class="btn">Back to menu</button>
  `;

  root.innerHTML = "";
  root.appendChild(host);

  const statusEl = host.querySelector("[data-testid=lobby-status]") as HTMLElement;
  const roomCodeEl = host.querySelector("[data-testid=room-code]") as HTMLElement;
  const linkInput = host.querySelector("[data-testid=room-link]") as HTMLInputElement;
  const copyBtn = host.querySelector("[data-testid=btn-copy-link]") as HTMLButtonElement;
  const codeInput = host.querySelector("[data-testid=input-room-code]") as HTMLInputElement;
  const joinBtn = host.querySelector("[data-testid=btn-join-room]") as HTMLButtonElement;
  const createBtn = host.querySelector("[data-testid=btn-create-room]") as HTMLButtonElement;
  const errorEl = host.querySelector("[data-testid=lobby-error]") as HTMLElement;
  const backBtn = host.querySelector("[data-testid=btn-back]") as HTMLButtonElement;

  let current: ControllerSnapshot | null =
    deps.controller === null ? null : deps.controller.getSnapshot();
  let copiedTimer: ReturnType<typeof setTimeout> | null = null;

  function syncCodeInput(): void {
    const raw = codeInput.value;
    const code = raw.toUpperCase();
    if (code !== raw) codeInput.value = code;
    joinBtn.disabled = !isRoomCode(code);
  }

  function render(): void {
    const snapshot = current;
    const room: RoomCode | null = snapshot === null ? null : snapshot.room;
    const error = snapshot === null ? "" : (snapshot.error ?? "");
    errorEl.textContent = error;
    // A failed join hides the room block so the join form is the retry path.
    const showRoom = room !== null && error === "";
    roomCodeEl.hidden = !showRoom;
    linkInput.hidden = !showRoom;
    copyBtn.hidden = !showRoom;
    roomCodeEl.textContent = showRoom ? room : "";
    linkInput.value = showRoom ? shareLink(room) : "";
    statusEl.textContent = describeOpponent(snapshot, room);
    createBtn.disabled = snapshot !== null;
    syncCodeInput();
  }

  function describeOpponent(snapshot: ControllerSnapshot | null, room: RoomCode | null): string {
    if (snapshot === null || room === null) return "Connecting…";
    const opponent: OpponentStatus = snapshot.opponent;
    if (opponent === "left") return "Opponent left — share the link again";
    return "Waiting for opponent…";
  }

  const unsubscribeController =
    deps.controller === null
      ? null
      : deps.controller.subscribe((snapshot) => {
          current = snapshot;
          render();
        });

  render();
  const timer = setInterval(render, SYNC_MS);

  createBtn.addEventListener("click", () => {
    deps.onCreate();
  });

  joinBtn.addEventListener("click", () => {
    syncCodeInput();
    if (joinBtn.disabled) return;
    deps.onJoin(codeInput.value);
  });

  backBtn.addEventListener("click", () => {
    deps.onBack();
  });

  copyBtn.addEventListener("click", () => {
    const link = linkInput.value;
    if (link === "") return;
    copyToClipboard(link);
    copyBtn.textContent = COPIED_TEXT;
    if (copiedTimer !== null) void clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      copyBtn.textContent = COPY_BUTTON_TEXT;
      copiedTimer = null;
    }, COPIED_MS);
  });

  return () => {
    if (unsubscribeController !== null) unsubscribeController();
    void clearInterval(timer);
    if (copiedTimer !== null) void clearTimeout(copiedTimer);
    root.innerHTML = "";
  };
}
