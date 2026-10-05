# B-007 — `input-room-code` is not auto-uppercased: a typed lower-case code stays lower-case

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
