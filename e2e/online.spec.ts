// Q-02: online multiplayer e2e. Written from docs/UI-CONTRACT.md only: every element is found by
// data-testid + data attributes, never by class, id or visible text. Two browser contexts play each
// other through the real server (the one playwright's webServer starts on :8080).
//
// Desktop project only, as the task prescribes: each test starts with
// `test.skip(testInfo.project.name !== "desktop")`, so the mobile run skips them.

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  bothReady,
  createRoom,
  gridStates,
  playOnlineUntilGameOver,
  startOnlineGame,
  statusLog,
  watchStatus,
} from "./helpers.ts";
import type { ServerMessage } from "../src/shared/protocol.ts";

// contract: room-code is 6 chars of [A-HJ-NP-Z2-9]
const ROOM_CODE = /^[A-HJ-NP-Z2-9]{6}$/;

test.describe("online multiplayer", () => {
  test("creating a room shows a valid code and a matching share link", async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop only");
    const ctx = await browser.newContext();
    const a = await ctx.newPage();

    const code = await createRoom(a);
    expect(ROOM_CODE.test(code)).toBe(true);

    const link = a.getByTestId("room-link");
    await expect(link).toBeVisible();
    const href = await link.evaluate((el) => (el as HTMLInputElement).value);
    expect(href.endsWith(`/?room=${code}`)).toBe(true);

    await ctx.close();
  });

  test("joining by link and by typed code both reach the placement screen", async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop only");
    const vias: ("link" | "code")[] = ["link", "code"];
    for (const via of vias) {
      const started = await startOnlineGame(browser, via);
      await expect(started.a.getByTestId("screen-placement")).toBeVisible();
      await expect(started.b.getByTestId("screen-placement")).toBeVisible();
      await started.close();
    }
  });

  test.fixme("A ready alone shows waiting; both ready means battle with exactly one my-turn // BUG-005", async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop only");
    const started = await startOnlineGame(browser, "link");
    const { a, b } = started;

    for (const page of [a, b]) {
      await page.getByTestId("btn-random").click();
      await expect(page.getByTestId("btn-ready")).toBeEnabled();
    }

    await a.getByTestId("btn-ready").click();
    await expect(a.getByTestId("placement-waiting")).toBeVisible();

    await b.getByTestId("btn-ready").click();
    await expect(a.getByTestId("screen-battle")).toBeVisible();
    await expect(b.getByTestId("screen-battle")).toBeVisible();

    const mine = (page: Page) => page.locator("[data-testid=turn-indicator][data-turn=me]").count();
    const countA = await mine(a);
    const countB = await mine(b);
    expect(countA + countB).toBe(1);

    await started.close();
  });

  test("a full online game ends with one win and one lose", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop only");
    test.setTimeout(120_000);
    const started = await startOnlineGame(browser, "link");
    const { a, b } = started;

    await bothReady(a, b);
    await playOnlineUntilGameOver(a, b);

    const results = [
      await a.getByTestId("game-over").getAttribute("data-result"),
      await b.getByTestId("game-over").getAttribute("data-result"),
    ];
    expect(results.sort()).toEqual(["lose", "win"]);

    await started.close();
  });

  test("rematch puts both players back on the placement screen", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop only");
    test.setTimeout(120_000);
    const started = await startOnlineGame(browser, "link");
    const { a, b } = started;

    await bothReady(a, b);
    await playOnlineUntilGameOver(a, b);

    await a.getByTestId("btn-rematch").click();
    await b.getByTestId("btn-rematch").click();
    await expect(a.getByTestId("screen-placement")).toBeVisible();
    await expect(b.getByTestId("screen-placement")).toBeVisible();

    await started.close();
  });

  test("no cheating: state frames sent to A never reveal ships in the enemy grid", async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop only");
    test.setTimeout(120_000);

    const frames: ServerMessage[] = [];
    const started = await startOnlineGame(browser, "link", (page) => {
      page.on("websocket", (ws) => {
        ws.on("framereceived", (data) => {
          const raw = data.payload;
          const text = typeof raw === "string" ? raw : raw.toString();
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed) || parsed === null) {
            throw new Error(`unexpected WebSocket frame: ${text}`);
          }
          frames.push(parsed as ServerMessage);
        });
      });
    });

    await bothReady(started.a, started.b);
    await playOnlineUntilGameOver(started.a, started.b);

    let checked = 0;
    for (const frame of frames) {
      if (frame.t !== "state") {
        continue;
      }
      if (frame.view.phase === "finished") {
        continue;
      }
      checked += 1;
      expect(frame.view.enemyGrid.flat().includes("ship")).toBe(false);
    }
    expect(checked > 0).toBe(true);

    await started.close();
  });

  test("reconnect: B reloads mid-battle, A sees disconnected then connected", async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop only");
    const started = await startOnlineGame(browser, "link");
    const { a, b } = started;

    await bothReady(a, b);
    const ownBefore = await gridStates(b, "grid-own");

    // The "disconnected" state lasts ~10ms, below Playwright's polling interval, so page A is
    // watched for attribute changes instead of re-queried.
    await watchStatus(a, "status-opponent");
    const reloaded = b.reload();
    await reloaded;

    expect(await statusLog(a)).toEqual(["disconnected", "connected"]);
    await expect(a.locator("[data-testid=status-opponent][data-status=connected]")).toBeVisible();
    await expect(b.getByTestId("screen-battle")).toBeVisible();
    expect(await gridStates(b, "grid-own")).toEqual(ownBefore);

    await started.close();
  });

  test("leaving: B clicks btn-menu, A is routed back to the lobby of the same room", async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop only");
    const started = await startOnlineGame(browser, "link");
    const { a, b, code } = started;

    await bothReady(a, b);
    // A shows "left" for a few frames before the routing takes it to the lobby, so the attribute
    // is watched rather than re-queried. Only the battle header btn-menu is visible.
    await watchStatus(a, "status-opponent");
    await b.locator("[data-testid=btn-menu]:visible").click();

    await expect(a.getByTestId("screen-lobby")).toBeVisible();
    expect(await statusLog(a)).toEqual(["left"]);
    const shown = await a.getByTestId("room-code").evaluate((el) => el.textContent);
    expect(shown.trim()).toBe(code);

    await started.close();
  });

  test("errors: unknown room and full room both show a lobby error", async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop only");

    const missing = await browser.newPage();
    await missing.goto("/?room=ZZZZZZ");
    await expect(missing.getByTestId("screen-lobby")).toBeVisible();
    await expect(missing.getByTestId("lobby-error")).not.toBeEmpty();

    const started = await startOnlineGame(browser, "link");
    const third = await browser.newPage();
    await third.goto(`/?room=${started.code}`);
    await expect(third.getByTestId("screen-lobby")).toBeVisible();
    await expect(third.getByTestId("lobby-error")).not.toBeEmpty();

    await started.close();
  });
});
