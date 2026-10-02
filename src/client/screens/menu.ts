import type { AiDifficulty } from "../../shared/types.ts";

export interface MenuDeps {
  onPlayAi(difficulty: AiDifficulty): void;
  onPlayOnline(): void;
}

export function mountMenu(root: HTMLElement, deps: MenuDeps): () => void {
  const host = document.createElement("section");
  host.setAttribute("data-testid", "screen-menu");
  host.innerHTML = `
    <h1>Battleship</h1>
    <select data-testid="select-difficulty">
      <option value="easy">Easy</option>
      <option value="normal" selected>Normal</option>
    </select>
    <button data-testid="btn-play-ai" class="btn">Play vs Computer</button>
    <button data-testid="btn-play-online" class="btn">Play Online</button>
  `;

  root.innerHTML = "";
  root.appendChild(host);

  const select = host.querySelector("[data-testid=select-difficulty]") as HTMLSelectElement;
  const playAiBtn = host.querySelector("[data-testid=btn-play-ai]") as HTMLButtonElement;
  const playOnlineBtn = host.querySelector("[data-testid=btn-play-online]") as HTMLButtonElement;

  playAiBtn.addEventListener("click", () => {
    deps.onPlayAi(select.value as AiDifficulty);
  });

  playOnlineBtn.addEventListener("click", () => {
    deps.onPlayOnline();
  });

  const _removeListeners = () => {
    if (playAiBtn.onclick) {
      playAiBtn.removeEventListener("click", playAiBtn.onclick);
    }
    if (playOnlineBtn.onclick) {
      playOnlineBtn.removeEventListener("click", playOnlineBtn.onclick);
    }
    root.innerHTML = "";
  };

  return _removeListeners;
}
