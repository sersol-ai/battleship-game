import { test, expect } from "@playwright/test";
import { cell, fireRowMajor, gridStates, playUntilGameOver, startAiGame } from "./helpers.ts";
// BUG-03 (styles.css declared its CSS variables on `root`, so --cell was undefined and every
// grid cell rendered 0x0 — unclickable) blocked tests 3-9, which were left as `test.fixme`.
// Q-02 re-enabled them (`test.fixme` -> `test`) after the fix landed on main; they are unchanged
// otherwise and all pass, which closes the coverage loop for that bug.

test.describe("vs computer (AI)", () => {
  test("menu shows both entry points and defaults difficulty to normal", async ({ page }) => {
    await page.goto("/?seed=42&aidelay=0");
    await expect(page.getByTestId("screen-menu")).toBeVisible();
    await expect(page.getByTestId("btn-play-ai")).toBeVisible();
    await expect(page.getByTestId("btn-play-online")).toBeVisible();
    const select = page.getByTestId("select-difficulty");
    await expect(select).toBeVisible();
    await expect(await select.evaluate((el) => (el as HTMLSelectElement).value)).toBe("normal");
  });

  test("btn-random places the whole fleet, btn-reset clears it", async ({ page }) => {
    await page.goto("/?seed=42&aidelay=0");
    await page.getByTestId("screen-menu").waitFor();
    await page.getByTestId("btn-play-ai").click();
    await page.getByTestId("screen-placement").waitFor();

    await expect(page.getByTestId("btn-ready")).toBeDisabled();
    await page.getByTestId("btn-random").click();
    for (const type of ["carrier", "battleship", "cruiser", "submarine", "destroyer"]) {
      await expect(page.getByTestId(`ship-${type}`)).toHaveAttribute("data-placed", "true");
    }
    await expect(page.getByTestId("btn-ready")).toBeEnabled();

    await page.getByTestId("btn-reset").click();
    for (const type of ["carrier", "battleship", "cruiser", "submarine", "destroyer"]) {
      await expect(page.getByTestId(`ship-${type}`)).not.toHaveAttribute("data-placed", "true");
    }
    await expect(page.getByTestId("btn-ready")).toBeDisabled();
  });

  test("manual placement: carrier is selected by default, A1 places it, rotate toggles", async ({
    page,
  }) => {
    await page.goto("/?seed=42&aidelay=0");
    await page.getByTestId("screen-menu").waitFor();
    await page.getByTestId("btn-play-ai").click();
    await page.getByTestId("screen-placement").waitFor();

    await expect(page.getByTestId("ship-carrier")).toHaveAttribute("data-selected", "true");
    await cell(page, "grid-placement", 0, 0).click();
    await expect(page.getByTestId("ship-carrier")).toHaveAttribute("data-placed", "true");
    for (let x = 0; x < 5; x += 1) {
      await expect(cell(page, "grid-placement", x, 0)).toHaveAttribute("data-state", "ship");
    }

    await expect(page.getByTestId("btn-rotate")).toHaveAttribute("data-orientation", "H");
    await page.getByTestId("btn-rotate").click();
    await expect(page.getByTestId("btn-rotate")).toHaveAttribute("data-orientation", "V");
    await page.keyboard.press("r");
    await expect(page.getByTestId("btn-rotate")).toHaveAttribute("data-orientation", "H");
  });

  test("invalid spot: battleship at B2 next to carrier at A1 is refused", async ({ page }) => {
    await page.goto("/?seed=42&aidelay=0");
    await page.getByTestId("screen-menu").waitFor();
    await page.getByTestId("btn-play-ai").click();
    await page.getByTestId("screen-placement").waitFor();

    await cell(page, "grid-placement", 0, 0).click();
    await expect(page.getByTestId("ship-carrier")).toHaveAttribute("data-placed", "true");
    await page.getByTestId("ship-battleship").click();
    await cell(page, "grid-placement", 1, 1).click();

    await expect(page.getByTestId("placement-error")).not.toBeEmpty();
    await expect(page.getByTestId("ship-battleship")).not.toHaveAttribute("data-placed", "true");
    await expect(cell(page, "grid-placement", 1, 1)).toHaveAttribute("data-state", "empty");
  });

  test("clicking a placed ship cell picks it up", async ({ page }) => {
    await page.goto("/?seed=42&aidelay=0");
    await page.getByTestId("screen-menu").waitFor();
    await page.getByTestId("btn-play-ai").click();
    await page.getByTestId("screen-placement").waitFor();

    await cell(page, "grid-placement", 0, 0).click();
    await expect(page.getByTestId("ship-carrier")).toHaveAttribute("data-placed", "true");
    await cell(page, "grid-placement", 2, 0).click();
    await expect(page.getByTestId("ship-carrier")).toHaveAttribute("data-selected", "true");
    await expect(page.getByTestId("ship-carrier")).not.toHaveAttribute("data-placed", "true");
    for (let x = 0; x < 5; x += 1) {
      await expect(cell(page, "grid-placement", x, 0)).toHaveAttribute("data-state", "empty");
    }
  });

  test("full game vs easy AI (seed 42) ends with a result", async ({ page }) => {
    await startAiGame(page, { seed: 42, difficulty: "easy" });
    await expect(page.getByTestId("turn-indicator")).toHaveAttribute("data-turn", "me");
    const shots = await playUntilGameOver(page);
    expect(shots).toBeGreaterThan(0);

    const result = await page.getByTestId("game-over").getAttribute("data-result");
    expect(result === "win" || result === "lose").toBe(true);

    const own = await gridStates(page, "grid-own");
    const enemyLeft = await page.getByTestId("enemy-remaining").getAttribute("data-count");
    expect(own.some((state) => state === "hit" || state === "sunk") || enemyLeft === "0").toBe(
      true,
    );
  });

  test("firing twice at the same enemy cell changes nothing", async ({ page }) => {
    await startAiGame(page, { seed: 42 });
    const target = cell(page, "grid-enemy", 0, 0);
    await expect(target).toHaveAttribute("data-state", "unknown");
    await target.click();
    await expect(target).not.toHaveAttribute("data-state", "unknown");
    await expect(page.getByTestId("turn-indicator")).toHaveAttribute("data-turn", "me");

    const enemyBefore = (await gridStates(page, "grid-enemy")).filter(
      (state) => state !== "unknown",
    ).length;
    const ownBefore = (await gridStates(page, "grid-own")).filter(
      (state) => state !== "empty" && state !== "ship",
    ).length;
    await target.click();
    const enemyAfter = (await gridStates(page, "grid-enemy")).filter(
      (state) => state !== "unknown",
    ).length;
    const ownAfter = (await gridStates(page, "grid-own")).filter(
      (state) => state !== "empty" && state !== "ship",
    ).length;
    expect(enemyAfter).toBe(enemyBefore);
    expect(ownAfter).toBe(ownBefore);
  });

  test("game over -> btn-rematch -> placement; game over -> btn-menu -> menu", async ({ page }) => {
    await startAiGame(page, { seed: 42 });
    await playUntilGameOver(page);
    await expect(page.getByTestId("game-over")).toBeVisible();

    await page.getByTestId("btn-rematch").click();
    await expect(page.getByTestId("screen-placement")).toBeVisible();
    await expect(page.getByTestId("btn-ready")).toBeDisabled();
    await page.getByTestId("btn-random").click();
    await page.getByTestId("btn-ready").click();
    await expect(page.getByTestId("screen-battle")).toBeVisible();
    await playUntilGameOver(page);
    await page.getByTestId("game-over").locator("[data-testid=btn-menu]").click();
    await expect(page.getByTestId("screen-menu")).toBeVisible();
  });

  test("the same seed replays identically on two fresh pages", async ({ browser }) => {
    const first = await browser.newPage();
    const second = await browser.newPage();
    await startAiGame(first, { seed: 42 });
    await startAiGame(second, { seed: 42 });
    await fireRowMajor(first, 5);
    await fireRowMajor(second, 5);
    expect(await gridStates(first, "grid-own")).toEqual(await gridStates(second, "grid-own"));
  });
});
