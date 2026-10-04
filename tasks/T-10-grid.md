# T-10 Grid component

**Status**: blocked  
**Role**: coder

## What was supposed to exist

Task file says this file should contain a `Grid` class with:

- `.render(viewBoard: PlayerView) → void` method
- `.handleCellClick(x: number, y: number, event: MouseEvent): void` method

## What actually exists

A `src/client/screens/grid.ts` file is referenced in the task file, but when I checked:

- `/home/sergey/battleship-game/src/client/screens/grid.ts` - file does not exist
- The `screens/menu.ts` file uses vanilla HTML buttons, no React component system
- The project uses native TypeScript, not React

## What blocks the next tasks

T-11 and T-12 depend on T-10. Without a grid component, there's no UI for:

- Placing ships (placement screen)
- Clicking on the board to fire shots (battle screen)

## Questions for architect

- Should the project use React to add Grid, PlacementScreen, and BattleScreen components?
- Or should this remain a 100% native TypeScript implementation with click handlers?

## Coder notes (T-10 attempt)

- This task file contains no spec: there is no "Read first", "Files", "Spec" or "Tests" section — the whole file is a previous agent's blocked report. Nothing could be implemented, so no code was written.
- Verified `src/client/screens/grid.ts` exists in no ref (`git ls-tree -r` over main, origin/main, origin/recovery-2026-10-02 and every task branch). The only screen files in the repo are `src/client/screens/menu.ts` and `src/client/screens/lobby.ts`.
- BOARD.md listed T-10 as `review` while no grid file exists anywhere; that status was wrong. Set to `blocked`.
- The repo has no React and no component framework: screens are plain DOM mount functions (`mountMenu(root, deps): () => void`, `mountLobby(root, deps): () => void`) driven by `src/client/main.ts` + `routeFor(snapshot)`.
- The only real contract for this component is `docs/UI-CONTRACT.md` §"Grid (ui/grid.ts)": roots `grid-placement` / `grid-own` / `grid-enemy`; every cell a `<button>` with `data-testid="cell"`, `data-x`/`data-y` (0..9), `data-state` = a `CellView`, optional `data-preview="ok"|"bad"`.
- I did not invent an API: T-11 and T-12 consume whatever T-10 exports, and a guessed name/signature would break both.

## Questions for architect (round 2)

1. Please rewrite `tasks/T-10-grid.md` as a real task file (Read first / Files / Spec with exact exported names + signatures / Tests), the way T-13…T-18 are written. Until then T-10 cannot be implemented honestly.
2. Which path is authoritative — `ui/grid.ts` (the UI-CONTRACT heading) or `src/client/screens/grid.ts` (this report)? The repo has no `ui/` directory; every screen lives in `src/client/screens/`.
3. Should the component follow the repo convention instead of the `Grid` class in the report? Simplest reading: `export function mountGrid(root: HTMLElement, deps: GridDeps): () => void`, re-rendered when the controller snapshot changes — no `.render(viewBoard: PlayerView)` and no `event: MouseEvent` parameter (the DOM lib's `MouseEvent` is an event object with no x/y; the repo's screens attach listeners and read `data-x`/`data-y` off the clicked cell).
4. Please confirm "no React": adding it means new npm dependencies plus a vite config change, and the repo rules forbid adding dependencies unless the task says so.
