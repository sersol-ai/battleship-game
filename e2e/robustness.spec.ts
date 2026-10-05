// Q-03: robustness, mobile layout, keyboard access and protocol abuse. Written from docs/UI-CONTRACT.md
// and the task list only: every element is found by data-testid + data attributes, never by class,
// id or visible text. Tests 1-2 run in the "mobile" project (Pixel 7), tests 3-7 in "desktop".
//
// BUG-06: no cell button carries an aria-label, so test 7 is `test.fixme` (see tasks/bugs/B-006).
// The keyboard half of test 7 (Tab focus + Enter) is covered separately and runs green.

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { cell, startOnlineGame, bothReady } from "./helpers.ts";
import type { ServerMessage } from "../src/shared/protocol.ts";

/** The page never scrolls sideways: the document is exactly as wide as the viewport. */
async function noHorizontalScroll(page: Page) {
  return await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}

/** The `data-state` of every cell of `grid`, row-major. */
async function cellStates(page: Page, grid: string): Promise<string[]> {
  return await page
    .getByTestId(grid)
    .locator("[data-testid=cell]")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-state") ?? ""));
}

/** Every grid is fully inside the viewport once the page is scrolled to it. */
async function gridFullyVisible(page: Page, grid: string) {
  const locator = page.getByTestId(grid);
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (box === null) {
    return false;
  }
  const viewport = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
  return (
    box.width > 0 &&
    box.height > 0 &&
    box.x >= 0 &&
    box.x + box.width <= viewport.w &&
    box.y >= 0 &&
    box.y + box.height <= viewport.h
  );
}

/** Open a raw browser WebSocket to /ws, send `payloads`, return the frames that come back. */
async function rawFrames(page: Page, payloads: string[], want: number) {
  const got = await page.evaluate(
    async (input: { payloads: string[]; want: number }) => {
      const ws = new WebSocket(`ws://${window.location.host}/ws`);
      const frames: string[] = [];
      let closed = false;
      ws.addEventListener("message", (ev) => frames.push(String(ev.data)));
      ws.addEventListener("close", () => {
        closed = true;
      });
      await new Promise<void>((open) => {
        ws.addEventListener("open", () => open());
        ws.addEventListener("error", () => open());
      });
      for (const payload of input.payloads) ws.send(payload);
      const deadline = Date.now() + 5000;
      while (frames.length < input.want && !closed && Date.now() < deadline) {
        await new Promise<void>((tick) => setTimeout(tick, 50));
      }
      return { frames, closed };
    },
    { payloads, want },
  );
  return got;
}

function errorCodes(frames: string[]) {
  const codes: string[] = [];
  for (const raw of frames) {
    const frame = JSON.parse(raw) as ServerMessage;
    if (frame.t === "error") {
      codes.push(frame.code);
    }
  }
  return codes;
}

/** HTTP status of /healthz as seen from inside the page. */
async function healthStatus(page: Page) {
  return await page.evaluate(async () => {
    const res = await fetch("/healthz");
    return res.status;
  });
}

test.describe("robustness", () => {
  test("mobile: menu, placement and battle screens never scroll sideways, grids fit the viewport", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile only");
    await page.goto("/?seed=42&aidelay=0");
    await expect(await noHorizontalScroll(page)).toBe(true);
    await page.getByTestId("btn-play-ai").click();
    await page.getByTestId("screen-placement").waitFor();
    await expect(await noHorizontalScroll(page)).toBe(true);
    await page.getByTestId("btn-random").click();
    await page.getByTestId("btn-ready").click();
    await page.getByTestId("screen-battle").waitFor();
    await expect(await noHorizontalScroll(page)).toBe(true);
    await expect(await gridFullyVisible(page, "grid-own")).toBe(true);
    await expect(await gridFullyVisible(page, "grid-enemy")).toBe(true);
  });

  test("mobile: tapping a placement cell puts the selected ship down", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile only");
    await page.goto("/?seed=42&aidelay=0");
    await page.getByTestId("btn-play-ai").click();
    await page.getByTestId("screen-placement").waitFor();
    await cell(page, "grid-placement", 0, 0).tap();
    await expect(cell(page, "grid-placement", 0, 0)).toHaveAttribute("data-state", "ship");
    const states = await cellStates(page, "grid-placement");
    expect(states.slice(0, 5)).toEqual(["ship", "ship", "ship", "ship", "ship"]);
    expect(states.filter((state) => state === "ship").length).toBe(5);
  });

  test("garbage frames get BAD_MESSAGE and the server stays up", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop only");
    await page.goto("/?seed=42&aidelay=0");
    const got = await rawFrames(
      page,
      ["garbage", "{}", JSON.stringify({ t: "fire", coord: { x: "a", y: 0 } })],
      3,
    );
    expect(got.frames.length).toBe(3);
    expect(errorCodes(got.frames)).toEqual(["BAD_MESSAGE", "BAD_MESSAGE", "BAD_MESSAGE"]);
    await expect(await healthStatus(page)).toBe(200);
  });

  test("firing before joining is refused with NOT_IN_ROOM", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop only");
    await page.goto("/?seed=42&aidelay=0");
    const got = await rawFrames(page, [JSON.stringify({ t: "fire", coord: { x: 0, y: 0 } })], 1);
    expect(errorCodes(got.frames)).toEqual(["NOT_IN_ROOM"]);
    await expect(await healthStatus(page)).toBe(200);
  });

  test("raw socket abuse in a real game: BAD_TOKEN, OUT_OF_BOUNDS, NOT_YOUR_TURN", async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop only");
    test.setTimeout(120_000);

    const joined: ServerMessage[] = [];
    const started = await startOnlineGame(browser, "link", (page) => {
      page.on("websocket", (ws) => {
        ws.on("framereceived", (ev) => {
          const raw = ev.payload;
          const text = typeof raw === "string" ? raw : raw.toString();
          joined.push(JSON.parse(text) as ServerMessage);
        });
      });
    });
    const { a, b, code } = started;
    let token = "";
    for (const frame of joined) {
      if (frame.t === "joined") {
        token = frame.token;
      }
    }
    expect(token === "").toBe(false);

    const wrongToken = await rawFrames(
      a,
      [JSON.stringify({ t: "resume", room: code, token: "00000000" })],
      1,
    );
    expect(errorCodes(wrongToken.frames)).toEqual(["BAD_TOKEN"]);

    await bothReady(a, b);
    if ((await a.getByTestId("turn-indicator").getAttribute("data-turn")) === "enemy") {
      await cell(b, "grid-enemy", 0, 0).click();
    }

    const seat = await rawFrames(
      a,
      [
        JSON.stringify({ t: "resume", room: code, token }),
        JSON.stringify({ t: "fire", coord: { x: 50, y: 0 } }),
        JSON.stringify({ t: "fire", coord: { x: 0, y: 0 } }),
        JSON.stringify({ t: "fire", coord: { x: 1, y: 0 } }),
      ],
      4,
    );
    const codes = errorCodes(seat.frames);
    expect(seat.frames.some((raw) => raw.includes('"t":"joined"'))).toBe(true);
    expect(codes.includes("OUT_OF_BOUNDS")).toBe(true);
    expect(codes.includes("NOT_YOUR_TURN")).toBe(true);
    await expect(await healthStatus(a)).toBe(200);

    await started.close();
  });

  test("a 20 KB frame closes the connection, the server stays healthy", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop only");
    await page.goto("/?seed=42&aidelay=0");
    const got = await rawFrames(page, ["x".repeat(20 * 1024)], 1);
    expect(got.closed).toBe(true);
    expect(got.frames.length).toBe(0);
    await expect(await healthStatus(page)).toBe(200);
  });

  test.fixme("every cell button carries a non-empty aria-label // BUG-06", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop only");
    await page.goto("/?seed=42&aidelay=0");
    await page.getByTestId("btn-play-ai").click();
    await page.getByTestId("btn-random").click();
    await page.getByTestId("btn-ready").click();
    await page.getByTestId("screen-battle").waitFor();
    for (const grid of ["grid-own", "grid-enemy"]) {
      const labels = await page
        .getByTestId(grid)
        .locator("[data-testid=cell]")
        .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));
      expect(labels.length).toBe(100);
      expect(labels.every((label) => label !== "")).toBe(true);
    }
  });

  test("keyboard: Tab reaches an enemy cell, Enter fires at it", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop only");
    await page.goto("/?seed=42&aidelay=0");
    await page.getByTestId("btn-play-ai").click();
    await page.getByTestId("btn-random").click();
    await page.getByTestId("btn-ready").click();
    await page.getByTestId("screen-battle").waitFor();
    const focused = async () =>
      await page.evaluate(() => {
        const el = document.activeElement;
        if (el === null || el === document.body) return "";
        if (el.closest('[data-testid="grid-enemy"]') === null) return "";
        return `${el.getAttribute("data-x") ?? ""}|${el.getAttribute("data-y") ?? ""}`;
      });
    let at = "";
    for (let i = 0; i < 10; i += 1) {
      await page.keyboard.press("Tab");
      at = await focused();
      if (at !== "") break;
    }
    expect(at === "").toBe(false);
    const [x, y] = at.split("|");
    const target = cell(page, "grid-enemy", Number(x), Number(y));
    expect(await target.getAttribute("data-state")).toBe("unknown");
    await page.keyboard.press("Enter");
    await expect(target).toHaveAttribute("data-state", /^(miss|hit|sunk)$/);
  });
});
