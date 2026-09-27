# T-10 — Grid component

Role: coder · Depends on: T-06, T-08 · Size: M

## Goal

One reusable 10×10 board widget used by the placement and battle screens.

## Read first

- `docs/UI-CONTRACT.md` section "Grid"
- `src/shared/types.ts` (Coord, GridView, CellView), `src/shared/rules.ts`
- `src/shared/view.ts` (`formatCoord` only)

## Files

- create `src/client/ui/grid.ts`
- create `src/client/ui/grid.test.ts`
- modify `src/client/styles.css` (append below `/* === grid (T-10) === */`)
- modify `package.json` (add devDependency `happy-dom` via `npm i -D happy-dom`)

## Spec

```ts
import type { Coord, GridView } from "../../shared/types.ts";

export interface GridOptions {
  testId: "grid-placement" | "grid-own" | "grid-enemy";
  label: string; // shown above the grid, e.g. "Your fleet"
  onCellClick?: (c: Coord) => void;
  onCellHover?: (c: Coord | null) => void; // null when pointer leaves the grid
}
export interface GridHandle {
  readonly el: HTMLElement;
  /** Sets data-state and aria-label on every cell. Never re-creates cell elements. */
  update(grid: GridView): void;
  /** Sets data-preview="ok"|"bad" on the given in-bounds cells; clears it on all others. */
  setPreview(cells: readonly Coord[], ok: boolean): void;
  clearPreview(): void;
  /** Disabled grid: cells get the `disabled` attribute, clicks are ignored. */
  setDisabled(disabled: boolean): void;
  /** Remove listeners. */
  destroy(): void;
}
export function createGrid(opts: GridOptions): GridHandle;
```

DOM (create once in `createGrid`):

```
<div class="grid-wrap" data-testid="{testId}">
  <div class="grid-label">{label}</div>
  <div class="grid" role="grid">          ← CSS grid 11 columns × 11 rows
    <div class="grid-corner"></div> + 10 column headers A..J
    per row: 1 row header "1".."10" + 10 cells:
      <button type="button" class="cell" data-testid="cell" data-x="3" data-y="5"
              data-state="unknown" aria-label="D6 unknown"></button>
```

- One `click` listener and one `pointerover`/`pointerleave` pair on the `.grid` element
  (event delegation: `(e.target as HTMLElement).closest("[data-testid=cell]")`).
- `onCellHover` fires only when the hovered cell changes; `null` on `pointerleave`.
- Keyboard: cells are native buttons, so Enter/Space trigger click — nothing extra.

CSS (append): `.grid` uses `grid-template-columns: repeat(11, var(--cell))`, 2px gap.
Cell colours by `[data-state]`: unknown/empty → `--water`; ship → `--ship`; miss → `--water` with a
centred `--miss` dot (`::after`, 30% size, round); hit → `--hit`; sunk → `--sunk`.
`[data-preview="ok"]` → outline 2px `--accent`; `[data-preview="bad"]` → outline 2px `--danger`.
Disabled cells: `cursor: default`, no hover effect. Enabled `unknown` cells: hover brightens.

## Tests (grid.test.ts) — first line: `// @vitest-environment happy-dom`

1. Renders 100 cells with correct data-x/data-y; root has the given testid.
2. `update(filledGrid("miss"))` sets every data-state to "miss"; the cell elements are the same
   objects before/after (`===`).
3. Clicking cell (3,5) calls onCellClick with `{x:3,y:5}`; when disabled, not called.
4. `setPreview([{x:0,y:0},{x:1,y:0}], false)` → those two have data-preview "bad"; `clearPreview()` removes it.
5. aria-label uses formatCoord, e.g. `"D6 miss"`.

## Acceptance

`npm run format && npm run check` green.

## Out of scope

Placement logic, battle logic.

## Coder notes

## Questions for architect

## Review
