import { describe, expect, it } from "vitest";
import { levelFromStored } from "./index.ts";

describe("levelFromStored", () => {
  it.each([
    ["superbeginner", "superbeginner"],
    ["beginner", "beginner"],
    ["intermediate", "intermediate"],
    ["A1", "beginner"],
    ["A2", "intermediate"],
    ["B1", "intermediate"],
    ["B2", "intermediate"],
    ["C1", "superbeginner"],
    ["", "superbeginner"],
    [null, "superbeginner"],
    [undefined, "superbeginner"],
  ])("reads %j as %s", (stored, level) => {
    expect(levelFromStored(stored)).toBe(level);
  });
});
