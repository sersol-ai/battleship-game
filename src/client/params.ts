import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "../shared/protocol.ts";

export interface AppParams {
  seed: number; // ?seed=<int> (parseInt, base 10, then >>> 0); missing/invalid → fallbackSeed
  aiDelayMs: number; // ?aidelay=<int> clamped to 0..5000; missing/invalid → 600
  room: string | null; // ?room=<code> upper-cased; null unless exactly ROOM_CODE_LENGTH chars all in ROOM_CODE_ALPHABET
}

export function readParams(search: string, fallbackSeed: number): AppParams {
  const params = new URLSearchParams(search);

  // seed
  let seed = fallbackSeed;
  const seedStr = params.get("seed");
  if (seedStr !== null) {
    const parsed = parseInt(seedStr, 10);
    if (!isNaN(parsed)) {
      seed = parsed >>> 0;
    }
  }

  // aidelay
  let aiDelayMs = 600;
  const aiDelayStr = params.get("aidelay");
  if (aiDelayStr !== null) {
    const parsed = parseInt(aiDelayStr, 10);
    if (!isNaN(parsed)) {
      aiDelayMs = Math.max(0, Math.min(5000, parsed));
    }
  }

  // room
  const roomParam = params.get("room");
  let room: string | null = null;
  if (roomParam !== null && roomParam.length === ROOM_CODE_LENGTH) {
    const upper = roomParam.toUpperCase();
    if (upper.split("").every((c) => ROOM_CODE_ALPHABET.includes(c))) {
      room = upper;
    }
  }

  return { seed, aiDelayMs, room };
}
