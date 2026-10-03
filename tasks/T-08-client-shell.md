# T-08 — Client shell, params, routing, menu

Role: coder · Depends on: — · Size: M

## Goal

A running Vite app showing the menu screen, plus two small pure modules later tasks rely on.

## Read first

- `docs/ARCHITECTURE.md` section 4 (Client)
- `docs/UI-CONTRACT.md` sections "Screens" and "Menu"
- `src/client/controller.ts`, `src/shared/protocol.ts` (ROOM_CODE_* constants)

## Files

- create `src/client/index.html`, `src/client/styles.css`, `src/client/main.ts`
- create `src/client/params.ts`, `src/client/params.test.ts`
- create `src/client/routing.ts`, `src/client/routing.test.ts`
- create `src/client/screens/menu.ts`

## Spec — params.ts (pure; no `window` access)

```ts
export interface AppParams {
  seed: number; // ?seed=<int> (parseInt, base 10, then >>> 0); missing/invalid → fallbackSeed
  aiDelayMs: number; // ?aidelay=<int> clamped to 0..5000; missing/invalid → 600
  room: string | null; // ?room=<code> upper-cased; null unless exactly ROOM_CODE_LENGTH chars all in ROOM_CODE_ALPHABET
}
export function readParams(search: string, fallbackSeed: number): AppParams;
```

`main.ts` calls `readParams(location.search, Math.floor(Math.random() * 2 ** 32))` — the only
`Math.random()` in the client.

## Spec — routing.ts (pure)

```ts
import type { ControllerSnapshot } from "./controller.ts";
export type Route = "lobby" | "placement" | "battle";
export function routeFor(s: ControllerSnapshot): Route;
```

Rules, first match wins:

1. `s.mode === "online"` and `s.view === null` → `"lobby"`
2. `s.mode === "online"` and `view.phase === "placing"` and `!view.myPlaced` and
   `s.opponent` is `"waiting"` or `"left"` → `"lobby"`
3. `view.phase === "placing"` → `"placement"`
4. otherwise → `"battle"`
   (`mode "ai"` with `view === null` never happens; return `"placement"` for it.)

## Spec — screens/menu.ts

```ts
import type { AiDifficulty } from "../../shared/types.ts";
export interface MenuDeps {
  onPlayAi(difficulty: AiDifficulty): void;
  onPlayOnline(): void;
}
/** Renders into root (replacing its content). Returns unmount (removes listeners, clears root). */
export function mountMenu(root: HTMLElement, deps: MenuDeps): () => void;
```

Markup: `<section data-testid="screen-menu">` with title "Battleship", `select-difficulty`
(options easy/normal, normal selected), `btn-play-ai` ("Play vs computer"), `btn-play-online` ("Play online").

## Spec — main.ts (for now)

- Import `./styles.css`. Read params. `const app = document.getElementById("app")!` is allowed here only.
- Show the menu. `onPlayAi` / `onPlayOnline`: `console.log` for now (T-11 / T-18 replace this).
- If `params.room` is set: `console.log` for now (T-18 handles it).

## Spec — index.html / styles.css

- `index.html`: `<!doctype html>`, `lang="en"`, viewport meta, `<title>Battleship</title>`,
  `<main id="app"></main>`, `<script type="module" src="./main.ts"></script>`.
- `styles.css`: CSS variables on `:root`:
  `--bg:#0b1d2e; --panel:#12304a; --text:#e6f0f7; --muted:#8aa4b8; --accent:#3ec1d3; --water:#1e5a8a;
--ship:#9aa7b3; --miss:#cfe3f5; --hit:#e8a33d; --sunk:#c0392b; --danger:#ff6b6b; --cell:32px;`
  `@media (max-width: 420px) { :root { --cell: 8.5vw; } }`. Body: bg/text, system font, margin 0.
  Buttons: accent background, 8px radius, 44px min-height. `section[data-testid^="screen-"]`:
  centered column, max-width 760px, padding 16px. Leave a comment `/* === grid (T-10) === */` at the end.

## Tests

- params.test.ts: seed parse; invalid seed → fallback; aidelay default / clamp (`-5`→0, `99999`→5000);
  room `"k7pq2m"` → `"K7PQ2M"`; room with `0`/`O`/wrong length → null.
- routing.test.ts: one test per rule above, using hand-built snapshots (build a PlayerView via a
  small helper in the test file; any valid grids).

## Acceptance

- `npm run format && npm run check` green.
- `npm run dev`, open http://localhost:5173 → menu visible, buttons log to console. `npm run build:client` succeeds.

## Out of scope

Other screens, controllers.

Implemented params.ts (readParams with seed/aidelay/room parsing & validation), routing.ts (4-rule router), screens/menu.ts (mountMenu with unmount), main.ts (glue), index.html (HTML shell), styles.css (CSS vars + button/menu styles), css-declarations.d.ts (side-effect asset type). Created params.test.ts (13 tests) and routing.test.ts (7 tests).

## Questions for architect

## Review
