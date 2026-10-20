import { describe, expect, it } from "vitest";
import { MAX_PUPIL_OFFSET, pupilOffset } from "./gaze.ts";

const eyes = { x: 100, y: 100 };

describe("pupilOffset", () => {
  it("looks the full distance towards a far pointer", () => {
    const o = pupilOffset({ x: 1100, y: 100 }, eyes, false);
    expect(o.x).toBeCloseTo(MAX_PUPIL_OFFSET);
    expect(o.y).toBeCloseTo(0);
  });

  it("moves only part of the way for a close pointer", () => {
    const o = pupilOffset({ x: 140, y: 100 }, eyes, false);
    expect(o.x).toBeGreaterThan(0);
    expect(o.x).toBeLessThan(MAX_PUPIL_OFFSET);
  });

  it("looks up for a pointer straight above", () => {
    const o = pupilOffset({ x: 100, y: -500 }, eyes, false);
    expect(o.x).toBeCloseTo(0);
    expect(o.y).toBeCloseTo(-MAX_PUPIL_OFFSET);
  });

  it("never exceeds the maximum on a diagonal", () => {
    const o = pupilOffset({ x: 900, y: 900 }, eyes, false);
    expect(Math.hypot(o.x, o.y)).toBeCloseTo(MAX_PUPIL_OFFSET);
  });

  it("stays at rest under reduced motion", () => {
    expect(pupilOffset({ x: 900, y: 900 }, eyes, true)).toEqual({ x: 0, y: 0 });
  });

  it("stays at rest with no pointer or a pointer on the eyes", () => {
    expect(pupilOffset(null, eyes, false)).toEqual({ x: 0, y: 0 });
    expect(pupilOffset(eyes, eyes, false)).toEqual({ x: 0, y: 0 });
  });
});
