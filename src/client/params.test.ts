import { describe, it, expect } from "vitest";
import { readParams } from "./params.ts";

describe("params", () => {
  it("parses a valid seed", () => {
    const p = readParams("?seed=42", 999);
    expect(p.seed).toBe(42);
  });

  it("missing seed returns fallback", () => {
    const p = readParams("", 123);
    expect(p.seed).toBe(123);
  });

  it("invalid seed returns fallback", () => {
    const p = readParams("?seed=abc", 100);
    expect(p.seed).toBe(100);
  });

  it("negative seed is coerced with >>> 0", () => {
    const p = readParams("?seed=-1", 999);
    // -1 >>> 0 = 4294967295
    expect(p.seed).toBe(4294967295);
  });

  it("aidelay default is 600", () => {
    const p = readParams("", 0);
    expect(p.aiDelayMs).toBe(600);
  });

  it("aidelay -5 becomes 0", () => {
    const p = readParams("?aidelay=-5", 0);
    expect(p.aiDelayMs).toBe(0);
  });

  it("aidelay 99999 becomes 5000", () => {
    const p = readParams("?aidelay=99999", 0);
    expect(p.aiDelayMs).toBe(5000);
  });

  it("valid aidelay is preserved", () => {
    const p = readParams("?aidelay=1500", 0);
    expect(p.aiDelayMs).toBe(1500);
  });

  it("invalid aidelay returns default 600", () => {
    const p = readParams("?aidelay=abc", 0);
    expect(p.aiDelayMs).toBe(600);
  });

  it("upper-cases a valid room code", () => {
    const p = readParams("?room=k7pq2m", 0);
    expect(p.room).toBe("K7PQ2M");
  });

  it("room with 0 is null", () => {
    const p = readParams("?room=ABCDE0", 0);
    expect(p.room).toBeNull();
  });

  it("room with O is null", () => {
    const p = readParams("?room=ABCDEO", 0);
    expect(p.room).toBeNull();
  });

  it("room wrong length is null", () => {
    const p = readParams("?room=ABCD", 0);
    expect(p.room).toBeNull();
  });
});
