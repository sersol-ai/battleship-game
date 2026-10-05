# B-007 — `input-room-code` uppercases via a 100ms poll, not instantly on keystroke

Found by: Q-03 Severity: minor

## Steps

1. `npm run build && npm start`, open `http://localhost:8080/?seed=42&aidelay=0`
2. Click `btn-play-online` → `screen-lobby`
3. Type a lower-case room code into `[data-testid=input-room-code]` (e.g. `fr3vwu`)
4. Read the input's `value`

## Expected (cite UI-CONTRACT.md or task)

`docs/UI-CONTRACT.md` §Lobby: "`input-room-code` | text input, 6 chars, **auto-uppercased**" — the
value should read back as `FR3VWU`.

## Actual

The value stays exactly as typed: `fr3vwu`. Nothing upper-cases it, so the contract attribute
behaviour is missing. Joining still works because the server folds the code
(`src/shared/protocol.ts` line 12: "Case-insensitive on input; always upper-case on the wire"), so
this is a UI-only defect — but the lobby shows the user a code that does not match the `room-code`
of any room, and `input-room-code` is the element the contract promises to normalise.

## Evidence

Probe run on this branch (`e2e/probeA.spec.ts`, deleted after the run), desktop project; the room
created for the probe was `FR3VWU`; the probe typed the same code in lower case:

```
typed value=fr3vwu
filled value=fr3vwu
```

Same probe, for contrast, the elements that do match the contract:

```
room-link tag=data-testid=room-link type=text readonly= autocomplete=off hidden=
```

## Review

**Correcting the claim, not just confirming it** — this report overstates the defect. Wrote a
probe: `input.fill("fr3vwu")` then `input.inputValue()` immediately does read back `fr3vwu` (as
reported), but waiting past the screen's own `setInterval(render, SYNC_MS)` (`lobby.ts:16`,
`SYNC_MS = 100`) — which is what actually calls `syncCodeInput()` (`lobby.ts:63-68`) — the value
**is** `FR3VWU`. So "nothing upper-cases it" / "the value stays exactly as typed" is not accurate;
the mechanism exists and works. The real, narrower defect: it's a ~100ms **polling** correction
rather than an immediate `input`-event handler, so there's a brief visible window (and the exact
window the original probe happened to read in) where the field shows the wrong case before the
next tick fixes it. Retitling to reflect that. Severity stays minor — if anything, lower than
originally filed, not higher. **Status: open** (still a real, if smaller, defect — worth an
`input`-event listener instead of relying on the poll — but not the "nothing happens" bug as
written).
