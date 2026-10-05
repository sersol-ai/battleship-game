# B-006 — no battle/placement cell button carries an `aria-label`, so cells are unreadable to assistive tech

Found by: Q-03 Severity: major

## Steps

1. `npm run build && npm start`, open `http://localhost:8080/?seed=42&aidelay=0`
2. Click `btn-play-ai`, `btn-random`, `btn-ready` → `screen-battle`
3. For every `[data-testid=cell]` inside `grid-own` and `grid-enemy`, read `aria-label`

## Expected (cite UI-CONTRACT.md or task)

`tasks/Q-03-robustness.md` test 7: "Every cell button has a non-empty `aria-label`." The cells are
`<button>` elements (`docs/UI-CONTRACT.md` §Grid: "`cell` | every cell; a `<button>`") whose only
content is a CSS-drawn square, so without a name a screen reader announces 200 identical,
unlabelled buttons and the board cannot be read or played by ear.

## Actual

Every one of the 200 cell buttons has no `aria-label` attribute at all, so the accessible name is
the empty string. The cells do carry `data-x` / `data-y` / `data-state`, but those are data
attributes, not accessible names.

## Evidence

The assertion Q-03 test 7 makes (kept in the spec so the fix can be verified against it):

```
const labels = await page.getByTestId(grid)
  .locator("[data-testid=cell]")
  .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));
expect(labels.length).toBe(100);
expect(labels.every((label) => label !== "")).toBe(true);
```

Probe runs on the same build (`e2e/probe.spec.ts` and `e2e/probe4.spec.ts`, both deleted after the
run) — the battle screen's 100 enemy cells and the attributes of one cell:

```
labels sample: || empty=100/100
placement: data-testid=cell data-x=0 data-y=0 data-state=empty class=cell
battle:    data-testid=cell data-x=0 data-y=0 data-state=unknown class=cell disabled=
```

No `aria-label` anywhere; `empty=100/100` cells with an empty accessible name.

## Review
