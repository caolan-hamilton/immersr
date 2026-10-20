import { describe, expect, it } from "vitest";
import { MILESTONES, nextMilestone } from "./milestones.ts";

const hours = (h: number) => h * 3600;

describe("MILESTONES", () => {
  it("are 50, 150, 300, 600, 1,000 and 1,500 hours, each with a description", () => {
    expect(MILESTONES.map((m) => m.hours)).toEqual([50, 150, 300, 600, 1000, 1500]);
    for (const milestone of MILESTONES) expect(milestone.description.length).toBeGreaterThan(0);
  });
});

describe("nextMilestone", () => {
  // [Immersion time in seconds, hours of the next Milestone (undefined past the last one)]
  const table: [number, number | undefined][] = [
    [0, 50],
    [1, 50],
    [hours(50) - 1, 50],
    [hours(50), 150],
    [hours(50) + 1, 150],
    [hours(150) - 1, 150],
    [hours(150), 300],
    [hours(300) - 1, 300],
    [hours(300), 600],
    [hours(600) - 1, 600],
    [hours(600), 1000],
    [hours(1000) - 1, 1000],
    [hours(1000), 1500],
    [hours(1500) - 1, 1500],
    [hours(1500), undefined],
    [hours(2000), undefined],
  ];

  it.each(table)("at %i s the next Milestone is %s h", (seconds, expected) => {
    expect(nextMilestone(seconds).next?.hours).toBe(expected);
  });

  it("reports the time to go and how far along the road the Learner is", () => {
    expect(nextMilestone(hours(25))).toMatchObject({ remainingSeconds: hours(25), fraction: 0.5 });
    expect(nextMilestone(0)).toMatchObject({ remainingSeconds: hours(50), fraction: 0 });
  });

  it("is complete once every Milestone has been passed", () => {
    expect(nextMilestone(hours(1500))).toEqual({ next: undefined, remainingSeconds: 0, fraction: 1 });
  });

  it("treats negative time as none", () => {
    expect(nextMilestone(-10).next?.hours).toBe(50);
  });
});
