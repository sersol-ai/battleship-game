import { describe, it, expect } from "vitest";
import { isRoomCode, isCoord, isClientMessage, parseClientMessage } from "./guards.ts";
import { MAX_MESSAGE_BYTES, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "./protocol.ts";
import type { ClientMessage } from "./protocol.ts";

const FLEET_TWO: ClientMessage = {
  t: "place",
  fleet: [
    { type: "carrier", x: 0, y: 0, orientation: "H" },
    { type: "destroyer", x: 8, y: 9, orientation: "V" },
  ],
};

/** One valid message per protocol variant. */
const VALID_MESSAGES: readonly ClientMessage[] = [
  { t: "create" },
  { t: "join", room: "K7PQ2M" },
  { t: "resume", room: "ABCDEFGH".slice(0, ROOM_CODE_LENGTH), token: "a-token.123" },
  FLEET_TWO,
  { t: "fire", coord: { x: 3, y: 4 } },
  { t: "rematch" },
  { t: "leave" },
];

/** Raw frames that must all be rejected. */
const REJECTED_FRAMES: readonly (readonly [string, string])[] = [
  ["null literal", "null"],
  ["array", "[]"],
  ["number", "42"],
  ["empty object", "{}"],
  ["not json", "not json"],
  ["unknown t", '{"t":"nope"}'],
  ["join lowercase room", '{"t":"join","room":"k7pq2m"}'],
  ["join room too short", '{"t":"join","room":"ABC"}'],
  ["join room with 0", '{"t":"join","room":"ABCD0E"}'],
  ["join room with O", '{"t":"join","room":"ABCDOE"}'],
  ["fire x is 1.5", '{"t":"fire","coord":{"x":1.5,"y":0}}'],
  ["fire x is string", '{"t":"fire","coord":{"x":"1","y":0}}'],
  ["fire coord missing y", '{"t":"fire","coord":{"x":1}}'],
  ["fire coord is array", '{"t":"fire","coord":[1,2]}'],
  [
    "place has 11 ships",
    JSON.stringify({
      t: "place",
      fleet: Array.from({ length: 11 }, (unused, index) => ({
        type: "carrier",
        x: index % 10,
        y: 0,
        orientation: "H",
      })),
    }),
  ],
  ["place type boat", '{"t":"place","fleet":[{"type":"boat","x":0,"y":0,"orientation":"H"}]}'],
  [
    "place orientation lower",
    '{"t":"place","fleet":[{"type":"carrier","x":0,"y":0,"orientation":"h"}]}',
  ],
  [
    "place ship x string",
    '{"t":"place","fleet":[{"type":"carrier","x":"0","y":0,"orientation":"H"}]}',
  ],
  ["place empty fleet", '{"t":"place","fleet":[]}'],
  ["place fleet is object", '{"t":"place","fleet":{}}'],
  ["resume token 65 chars", `{"t":"resume","room":"ABCDEF","token":"${"t".repeat(65)}"}`],
  ["resume empty token", '{"t":"resume","room":"ABCDEF","token":""}'],
  ["resume missing token", '{"t":"resume","room":"ABCDEF"}'],
  ["t not a string", '{"t":42}'],
  ["no t at all", '{"room":"ABCDEF"}'],
];

describe("guards", () => {
  it("every protocol variant is accepted and round-trips through parseClientMessage", () => {
    for (const message of VALID_MESSAGES) {
      expect(isClientMessage(message)).toBe(true);
      const parsed = parseClientMessage(JSON.stringify(message));
      expect(parsed).toEqual(message);
    }
  });

  it("extra props are stripped, nested ones too", () => {
    const parsed = parseClientMessage('{"t":"fire","coord":{"x":1,"y":2,"evil":1},"z":9}');
    expect(parsed).toEqual({ t: "fire", coord: { x: 1, y: 2 } });
    const place = parseClientMessage(
      '{"t":"place","fleet":[{"type":"carrier","x":0,"y":0,"orientation":"H","evil":7}],"evil":1}',
    );
    expect(place).toEqual({
      t: "place",
      fleet: [{ type: "carrier", x: 0, y: 0, orientation: "H" }],
    });
  });

  it("rejected frames return null", () => {
    for (const [, raw] of REJECTED_FRAMES) {
      expect(parseClientMessage(raw)).toBeNull();
    }
    for (const [, raw] of REJECTED_FRAMES) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }
      expect(isClientMessage(parsed)).toBe(false);
    }
  });

  it("a frame longer than MAX_MESSAGE_BYTES is rejected before parsing", () => {
    const oversizedPlain = "x".repeat(MAX_MESSAGE_BYTES + 1);
    expect(parseClientMessage(oversizedPlain)).toBeNull();
    const oversizedJson = JSON.stringify({
      t: "fire",
      coord: { x: 0, y: 0 },
      pad: "a".repeat(MAX_MESSAGE_BYTES),
    });
    expect(oversizedJson.length).toBeGreaterThan(MAX_MESSAGE_BYTES);
    expect(parseClientMessage(oversizedJson)).toBeNull();
  });

  it("__proto__ payload is accepted as create and pollutes nothing", () => {
    const raw = '{"t":"create","__proto__":{"polluted":1}}';
    expect(parseClientMessage(raw)).toEqual({ t: "create" });
    expect(isClientMessage(JSON.parse(raw))).toBe(true);
    expect(({} as any).polluted).toBeUndefined();
    expect(([] as any).polluted).toBeUndefined();
    expect((parseClientMessage(raw) as any).polluted).toBeUndefined();
  });

  describe("isRoomCode", () => {
    it("accepts exactly ROOM_CODE_LENGTH chars from the alphabet", () => {
      expect(isRoomCode("K7PQ2M")).toBe(true);
      expect(isRoomCode(ROOM_CODE_ALPHABET.slice(0, ROOM_CODE_LENGTH))).toBe(true);
    });
    it("rejects wrong length, lower case, and 0/O/1/I", () => {
      expect(isRoomCode("ABCDEF")).toBe(true);
      expect(isRoomCode("ABCDE")).toBe(false);
      expect(isRoomCode("ABCDEFG")).toBe(false);
      expect(isRoomCode("abcdef")).toBe(false);
      expect(isRoomCode("ABCD1E")).toBe(false);
      expect(isRoomCode("ABCD0E")).toBe(false);
      expect(isRoomCode("ABCDOE")).toBe(false);
      expect(isRoomCode("")).toBe(false);
      expect(isRoomCode(null)).toBe(false);
      expect(isRoomCode(42)).toBe(false);
    });
  });

  describe("isCoord", () => {
    it("accepts any integer pair, including negatives and huge values", () => {
      expect(isCoord({ x: 0, y: 0 })).toBe(true);
      expect(isCoord({ x: -1, y: 500 })).toBe(true);
      expect(isCoord({ x: 50, y: 0 })).toBe(true);
    });
    it("rejects non-integer members and non-objects", () => {
      expect(isCoord({ x: 1.5, y: 0 })).toBe(false);
      expect(isCoord({ x: "1", y: 0 })).toBe(false);
      expect(isCoord({ x: 1 })).toBe(false);
      expect(isCoord({ x: Number.NaN, y: 0 })).toBe(false);
      expect(isCoord({ x: Number.POSITIVE_INFINITY, y: 0 })).toBe(false);
      expect(isCoord(null)).toBe(false);
      expect(isCoord([])).toBe(false);
      expect(isCoord("{x:1}")).toBe(false);
    });
  });

  describe("isClientMessage", () => {
    it("rejects non-objects and arrays even when they look like messages", () => {
      expect(isClientMessage(null)).toBe(false);
      expect(isClientMessage(42)).toBe(false);
      expect(isClientMessage("create")).toBe(false);
      expect(isClientMessage([{ t: "leave" }])).toBe(false);
      expect(isClientMessage({ t: "leave", extra: 1 })).toBe(true);
    });
    it("narrows a rejected value to nothing usable", () => {
      const frame = { t: "fire", coord: { x: 1, y: 2 }, extra: 3 };
      if (isClientMessage(frame)) {
        expect(frame.t).toBe("fire");
      }
    });
  });
});
