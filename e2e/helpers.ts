// Q-01: e2e helpers. Written from docs/UI-CONTRACT.md only: every element is found by
// data-testid + data attributes, never by class, id or visible text.

import { expect } from "@playwright/test";
import type { Page, Locator, Browser } from "@playwright/test";

const BOARD_SIZE = 10; // contract: data-x / data-y are integers 0..9

/** A grid cell, addressed the way UI-CONTRACT.md prescribes. */
export function cell(
  page: Page,
  grid: "grid-placement" | "grid-own" | "grid-enemy",
  x: number,
  y: number,
): Locator {
  return page.getByTestId(grid).locator(`[data-testid=cell][data-x="${x}"][data-y="${y}"]`);
}

/** Row-major list of the `data-state` of every cell of `grid`. */
async function states(
  page: Page,
  grid: "grid-own" | "grid-enemy" | "grid-placement",
): Promise<string[]> {
  const found = await page
    .getByTestId(grid)
    .locator("[data-testid=cell]")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-state") ?? ""));
  return found;
}

/** From the menu: choose difficulty, start, press Random, press Ready. Ends on the battle screen. */
export async function startAiGame(
  page: Page,
  opts?: { seed?: number; difficulty?: "easy" | "normal" },
): Promise<void> {
  const seed = opts?.seed ?? 42;
  const difficulty = opts?.difficulty ?? "normal";
  await page.goto(`/?seed=${seed}&aidelay=0`);
  await page.getByTestId("screen-menu").waitFor();

  // The difficulty <select> has no data attribute for its current value, so read `value`
  // (options are value="easy" / value="normal", default normal).
  const select = page.getByTestId("select-difficulty");
  await select.focus();
  await page.keyboard.press(difficulty === "easy" ? "e" : "n");
  await expect(await select.evaluate((el) => (el as HTMLSelectElement).value)).toBe(difficulty);

  await page.getByTestId("btn-play-ai").click();
  await page.getByTestId("screen-placement").waitFor();
  await page.getByTestId("btn-random").click();
  await page.getByTestId("btn-ready").click();
  await page.getByTestId("screen-battle").waitFor();
}

/** Fire at the first "unknown" enemy cell (row-major) whenever it's my turn, until game-over is visible. */
export async function playUntilGameOver(page: Page): Promise<number> {
  const myTurn = page.locator("[data-testid=turn-indicator][data-turn=me]");
  const gameOver = page.locator("[data-testid=game-over][data-result]");
  let shots = 0;
  while (shots < 100) {
    await myTurn.or(gameOver).first();
    if ((await gameOver.count()) > 0) {
      return shots;
    }
    const statesOfEnemy = await states(page, "grid-enemy");
    const index = statesOfEnemy.indexOf("unknown");
    if (index < 0) {
      throw new Error("playUntilGameOver: no unknown enemy cell left to fire at");
    }
    const target = cell(page, "grid-enemy", index % BOARD_SIZE, Math.floor(index / BOARD_SIZE));
    await expect(target).toHaveAttribute("data-state", "unknown");
    await target.click();
    await expect(target).not.toHaveAttribute("data-state", "unknown");
    shots += 1;
  }
  throw new Error("playUntilGameOver: game still running after 100 shots");
}

/** Fire `count` shots row-major from the top-left, waiting for my turn after each. */
export async function fireRowMajor(page: Page, count: number): Promise<void> {
  const myTurn = page.locator("[data-testid=turn-indicator][data-turn=me]");
  for (let i = 0; i < count; i += 1) {
    await expect(myTurn).toBeVisible();
    const target = cell(page, "grid-enemy", i % BOARD_SIZE, Math.floor(i / BOARD_SIZE));
    await expect(target).toHaveAttribute("data-state", "unknown");
    await target.click();
    await expect(target).not.toHaveAttribute("data-state", "unknown");
  }
  await expect(myTurn).toBeVisible();
}

/** Row-major list of the `data-state` of every cell of `grid`. */
export async function gridStates(page: Page, grid: "grid-own" | "grid-enemy"): Promise<string[]> {
  return states(page, grid);
}

/** One fresh page: menu → Play online → Create room. Leaves the page on the lobby screen (room block
    still showing) and returns the room code. */
export async function createRoom(page: Page): Promise<string> {
  await page.goto("/?seed=42&aidelay=0");
  await page.getByTestId("screen-menu").waitFor();
  await page.getByTestId("btn-play-online").click();
  await page.getByTestId("btn-create-room").click();
  const codeEl = page.getByTestId("room-code");
  await expect(codeEl).toBeVisible();
  const code = (await codeEl.evaluate((el) => el.textContent)).trim();
  return code;
}

/** Two fresh contexts: A creates a room, B joins it (by link or by typing the code). Both end on the
    placement screen. `watchA` runs on page A before it navigates, so a test can attach listeners
    (e.g. a WebSocket frame recorder) to it. Call `close()` when the test is done. */
export async function startOnlineGame(
  browser: Browser,
  via: "link" | "code",
  watchA?: (page: Page) => void,
): Promise<{ a: Page; b: Page; code: string; close: () => Promise<void> }> {
  const aCtx = await browser.newContext();
  const bCtx = await browser.newContext();
  const a = await aCtx.newPage();
  const b = await bCtx.newPage();
  if (watchA !== undefined) {
    watchA(a);
  }

  const code = await createRoom(a);

  if (via === "link") {
    await b.goto(`/?room=${code}`);
  } else {
    await b.goto("/?seed=42&aidelay=0");
    await b.getByTestId("screen-menu").waitFor();
    await b.getByTestId("btn-play-online").click();
    await b.getByTestId("input-room-code").fill(code);
    await b.getByTestId("btn-join-room").click();
  }

  await a.getByTestId("screen-placement").waitFor();
  await b.getByTestId("screen-placement").waitFor();
  return {
    a,
    b,
    code,
    close: async (): Promise<void> => {
      await aCtx.close();
      await bCtx.close();
    },
  };
}

/** Both press Random and Ready; both end on the battle screen. */
export async function bothReady(a: Page, b: Page): Promise<void> {
  for (const page of [a, b]) {
    await page.getByTestId("btn-random").click();
    await expect(page.getByTestId("btn-ready")).toBeEnabled();
  }
  await a.getByTestId("btn-ready").click();
  await b.getByTestId("btn-ready").click();
  await a.getByTestId("screen-battle").waitFor();
  await b.getByTestId("screen-battle").waitFor();
}

/** Start recording every value a `data-status` attribute takes from now on (read it back with
    `statusLog`). Playwright re-queries the DOM on ~100ms polling intervals, which misses states that
    last only a frame or two — the reconnect flips `status-opponent` through "disconnected" in ~10ms —
    so a test that wants a *sequence* of statuses has to watch the attribute inside the page. */
export async function watchStatus(
  page: Page,
  testid: "status-connection" | "status-opponent",
): Promise<void> {
  await page.evaluate((id: string) => {
    const el = document.querySelector(`[data-testid=${id}]`);
    if (el === null) {
      throw new Error(`watchStatus: no [data-testid=${id}] on this page`);
    }
    localStorage.setItem("status-log", "");
    new MutationObserver(() => {
      const next = el.getAttribute("data-status") ?? "";
      localStorage.setItem("status-log", `${localStorage.getItem("status-log") ?? ""}${next},`);
    }).observe(el, { attributeFilter: ["data-status"] });
  }, testid);
}

/** The statuses `watchStatus` recorded, in the order the page showed them. */
export async function statusLog(page: Page): Promise<string[]> {
  const raw = await page.evaluate(() => localStorage.getItem("status-log") ?? "");
  return raw.split(",").filter((entry) => entry !== "");
}

/** Both sides fire at their first unknown enemy cell (row-major) until both pages show game-over. */
export async function playOnlineUntilGameOver(a: Page, b: Page): Promise<void> {
  const myTurn = (page: Page) => page.locator("[data-testid=turn-indicator][data-turn=me]");
  const gameOver = (page: Page) => page.locator("[data-testid=game-over][data-result]");
  for (let shot = 0; shot < 200; shot += 1) {
    const overA = (await gameOver(a).count()) > 0;
    const overB = (await gameOver(b).count()) > 0;
    if (overA && overB) {
      return;
    }
    if (overA || overB) {
      await expect(gameOver(overA ? b : a)).toBeVisible();
      continue;
    }
    const turnA = (await myTurn(a).count()) > 0;
    const turnB = (await myTurn(b).count()) > 0;
    if (!turnA && !turnB) {
      await myTurn(a).or(myTurn(b)).first();
      continue;
    }
    const active = turnA ? a : b;
    const statesOfEnemy = await states(active, "grid-enemy");
    const index = statesOfEnemy.indexOf("unknown");
    if (index < 0) {
      throw new Error("playOnlineUntilGameOver: no unknown enemy cell left to fire at");
    }
    const target = cell(active, "grid-enemy", index % BOARD_SIZE, Math.floor(index / BOARD_SIZE));
    await expect(target).toHaveAttribute("data-state", "unknown");
    await target.click();
    await expect(target).not.toHaveAttribute("data-state", "unknown");
  }
  throw new Error("playOnlineUntilGameOver: game still running after 200 shots");
}
