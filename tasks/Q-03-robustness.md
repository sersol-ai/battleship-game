# Q-03 — Robustness, mobile, accessibility, abuse

Role: QA · Depends on: Q-02 · Size: M

## Goal

Hunt for bugs outside the happy path. Output is tests AND bug reports (`tasks/bugs/`).

## Read first

- `.pi/skills/e2e-testing/SKILL.md`, `docs/UI-CONTRACT.md`, `src/shared/protocol.ts`
- `e2e/helpers.ts`

## Files

- create `e2e/robustness.spec.ts`
- create `tasks/bugs/B-*.md` for every defect found (+ rows in `tasks/BOARD.md`)

## Tests — e2e/robustness.spec.ts

Mobile (run in the `mobile` project):

1. On menu, placement and battle screens: no horizontal scroll
   (`document.documentElement.scrollWidth <= window.innerWidth`) and both battle grids fully visible
   when scrolled into view.
2. Placement by tap works (tap cell places selected ship).

Protocol abuse (desktop; open a raw socket with `page.evaluate` using the browser `WebSocket` to `/ws`):

3. Send `"garbage"`, `"{}"`, `{"t":"fire","coord":{"x":"a"}}` → each gets `{"t":"error","code":"BAD_MESSAGE"}`;
   afterwards `GET /healthz` still 200.
4. `{"t":"fire","coord":{"x":0,"y":0}}` before joining → `NOT_IN_ROOM`.
5. In a real game (via helpers), a raw socket that resumes with a wrong token → `BAD_TOKEN`; firing out of
   turn via raw socket → `NOT_YOUR_TURN`; `x: 50` → `OUT_OF_BOUNDS`.
6. A 20 KB frame → connection closed by the server (maxPayload) and the server stays healthy.

Accessibility / keyboard (desktop):

7. Every cell button has a non-empty `aria-label`. Tab focus reaches an enemy cell; `Enter` fires at it.

Exploratory (manual, with the app running; write findings as bug files, not tests):

8. Rapid double-clicks on enemy cells; clicking during AI delay (`aidelay=1500`); resizing mid-game;
   pressing browser Back; two tabs of the same player; server restart mid-game (expected: client shows
   `status-connection` reconnecting, then an error — record what actually happens).

## Acceptance

- `npx playwright test` green (tests for known bugs are `test.fixme` with the bug id in the title).
- Summary in "Coder notes": list of bug ids with one line each.

## Coder notes

## Questions for architect

## Review
