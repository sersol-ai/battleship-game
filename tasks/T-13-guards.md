# T-13 — Validate untrusted client messages

Role: coder · Depends on: — · Size: S

## Goal

The server receives arbitrary bytes from the internet. Turn them into a typed `ClientMessage` or
reject them — never throw, never pass through garbage.

## Read first

- `src/shared/protocol.ts`
- `src/shared/types.ts` (ShipType, Orientation, Coord, Fleet), `src/shared/rules.ts` (SHIP_TYPES)

## Files

- create `src/shared/guards.ts`
- create `src/shared/guards.test.ts`

## Spec

```ts
import type { ClientMessage } from "./protocol.ts";

export function isRoomCode(x: unknown): x is string; // exactly ROOM_CODE_LENGTH chars, all in ROOM_CODE_ALPHABET (upper-case only)
export function isCoord(x: unknown): boolean; // object with integer x, y (any range — bounds are the engine's job)
export function isClientMessage(x: unknown): x is ClientMessage;
/**
 * raw.length > MAX_MESSAGE_BYTES → null. JSON.parse in try/catch → null on failure.
 * isClientMessage → return a NEW object containing ONLY the known fields (strip extras), else null.
 */
export function parseClientMessage(raw: string): ClientMessage | null;
```

`isClientMessage` rules — `x` must be a non-null, non-array object with string `t`:

| t         | extra requirements                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------ |
| `create`  | none                                                                                                         |
| `join`    | `isRoomCode(room)`                                                                                           |
| `resume`  | `isRoomCode(room)`; `token` string, length 1..64                                                             |
| `place`   | `fleet` array, length 1..10; each item: object, `type` in SHIP_TYPES, `orientation` "H"/"V", integer `x`,`y` |
| `fire`    | `isCoord(coord)`                                                                                             |
| `rematch` | none                                                                                                         |
| `leave`   | none                                                                                                         |
| other     | false                                                                                                        |

"integer" = `Number.isInteger(v)`. Stripping in `parseClientMessage` rebuilds nested objects too
(fleet items only get type/x/y/orientation; coord only x/y).

## Tests (guards.test.ts)

1. Each valid message type → accepted; `parseClientMessage` of its JSON deep-equals the input.
2. Extra props stripped: `{"t":"fire","coord":{"x":1,"y":2,"evil":1},"z":9}` → `{t:"fire",coord:{x:1,y:2}}`.
3. Rejected: `"null"`, `"[]"`, `"42"`, `"{}"`, `"not json"`, unknown t, join with lowercase room,
   room `"ABC"`, room with `"0"`, fire with `x: 1.5`, fire with `x: "1"`, place with 11 ships,
   place with type "boat", resume with 65-char token, and a string longer than MAX_MESSAGE_BYTES.
4. `__proto__` payload `{"t":"create","__proto__":{"polluted":1}}` → accepted, and
   `({} as any).polluted` is still undefined afterwards.

## Acceptance

`npm run format && npm run check` green.

## Out of scope

Server wiring. Game-rule validation (fleet shape/bounds are checked by the engine).

## Coder notes

## Questions for architect

## Review
