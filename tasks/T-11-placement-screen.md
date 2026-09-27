# T-11 — Placement screen + vs-AI wiring in main.ts

Role: coder · Depends on: T-08, T-09, T-10 · Size: L

## Goal

Player places 5 ships (click, rotate, random, reset), presses Ready. `main.ts` starts a vs-AI game
and routes between screens using `routeFor`.

## Read first

- `docs/UI-CONTRACT.md` sections "Placement screen" and "Grid"
- `src/client/controller.ts`, `src/client/routing.ts`, `src/client/ui/grid.ts` (exports), `src/client/main.ts`
- exports of `src/shared/{board,shots,view,placement,rng}.ts`, `src/shared/rules.ts`

## Files

- create `src/client/screens/placement.ts`
- create `src/client/screens/placement.test.ts`
- modify `src/client/main.ts`
- modify `src/client/styles.css` (append a `/* === placement (T-11) === */` section)

## Spec — screens/placement.ts

```ts
import type { GameController } from "../controller.ts";
import type { Rng } from "../../shared/types.ts";
export interface PlacementDeps {
  controller: GameController;
  rng: Rng; // for the Random button
  onExit(): void; // "Menu" button (testid btn-menu) in the header
}
export function mountPlacement(root: HTMLElement, deps: PlacementDeps): () => void;
```

Local state: `placed: Map<ShipType, ShipPlacement>`, `selected: ShipType | null` (starts `"carrier"`),
`orientation: Orientation` (starts `"H"`), `submitted: boolean`.

Layout: `<section data-testid="screen-placement">`, header with title + `btn-menu`, ship list
(one `ship-<type>` button per SHIP_TYPES entry: name + length squares), `btn-rotate`,
`btn-random`, `btn-reset`, the grid (`grid-placement`), `placement-error` (a `<p>`, empty text by
default), `btn-ready`, `placement-waiting` (hidden until submitted).

Behaviour:

- Grid content = `ownGrid(createBoard([...placed.values()]))`. Re-render after every change.
- Hover (cell c, a ship selected): `candidate = {type:selected, x:c.x, y:c.y, orientation}`;
  `ok = validateShip(candidate, [...placed.values()]) === null`; `grid.setPreview(shipCells(candidate), ok)`
  (grid ignores out-of-bounds cells itself). Hover null → `clearPreview()`.
- Click cell c:
  - if `shipAt(placedFleet, c)` → pick it up: remove from `placed`, `selected = its type`,
    `orientation = its orientation`, error text cleared.
  - else if a ship is selected: validate as above. Invalid → `placement-error` text:
    OUT_OF_BOUNDS "Ship doesn't fit there." / OVERLAP "Ships can't overlap." / ADJACENT "Ships can't touch.".
    Valid → add, clear error, `selected` = first unplaced type in SHIP_TYPES order (or null).
- Clicking `ship-<type>`: select it (if placed, it is picked up as above).
- `btn-rotate` and key `r`/`R` (keydown on `document`; removed on unmount): toggle orientation,
  update `data-orientation`, recompute preview for the last hovered cell.
- `btn-random`: `placed` = `randomFleet(deps.rng)`, selected null. `btn-reset`: clear all, selected carrier.
- `btn-ready`: `disabled` unless all 5 placed. Click → `submitted = true`, `controller.place(fleet)`.
- Subscribe to controller: if `snapshot.error` and submitted → show it in `placement-error`, `submitted = false`.
  If `view.myPlaced` → show `placement-waiting` ("Waiting for opponent…"), disable all controls and grid.
- `ship-<type>` attributes: `data-placed`, `data-selected`. Unmount: unsubscribe, destroy grid, remove keydown.

## Spec — main.ts

Replace the menu's `onPlayAi` log with starting a game. Structure (keep it this simple):

```ts
let controller: GameController | null = null;
let unsubscribe = () => {};
let unmount = () => {};
let route: Route | "menu" = "menu";

function mount(next: Route | "menu") { unmount(); route = next; unmount = /* mountX(app, deps) by route */; }
function startGame(c: GameController) {
  controller = c;
  unsubscribe = c.subscribe((s) => { const r = routeFor(s); if (r !== route) mount(r); });
}
function exitToMenu() { unsubscribe(); controller?.dispose(); controller = null; mount("menu"); }
```

`onPlayAi(d)` → `startGame(createLocalController({ difficulty: d, seed: params.seed, aiDelayMs: params.aiDelayMs }))`.
Placement's `rng` = `createRng(params.seed ^ 0x5bd1e995)`. Route `"battle"`: render a placeholder
`<section data-testid="screen-battle">Battle (T-12)</section>` for now. `"lobby"`: placeholder too.

## Tests (placement.test.ts) — `// @vitest-environment happy-dom`

Use a fake controller (object implementing GameController with `vi.fn()` methods and a
`push(snapshot)` helper). Tests: Ready disabled initially; Random → 5 `data-placed="true"` and
Ready enabled; clicking A1 with carrier H places cells (0..4,0) as "ship"; clicking B2 (x1,y1) next with
battleship H shows the ADJACENT message; rotate toggles `data-orientation`; clicking a placed
carrier cell un-places it; Ready calls `controller.place` with 5 ships.

## Acceptance

- `npm run format && npm run check` green.
- Manual: `npm run dev` → Play vs computer → place ships → Ready → battle placeholder appears.

## Out of scope

Battle screen, online.

## Coder notes

## Questions for architect

## Review
