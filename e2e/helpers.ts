// Q-01: e2e helpers. Written from docs/UI-CONTRACT.md only: every element is found by
// data-testid + data attributes, never by class, id or visible text.

import { expect } from "@playwright/test";
import type { Page, Locator } from "@playwright/test";

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
