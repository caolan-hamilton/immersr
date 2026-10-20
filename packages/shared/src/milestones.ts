/** A Milestone: an amount of Immersion time in one Target language that marks a known stage of acquisition. */
export interface Milestone {
  hours: number;
  /** Plain words for what this stage of listening usually brings. */
  description: string;
}

export const MILESTONES: readonly Milestone[] = [
  { hours: 50, description: "following slow, simple speech" },
  { hours: 150, description: "understanding the gist of everyday talk" },
  { hours: 300, description: "following most conversations on familiar topics" },
  { hours: 600, description: "understanding most things said at a natural pace" },
  { hours: 1000, description: "following almost any conversation with ease" },
  { hours: 1500, description: "listening in the language like a native speaker" },
];

export interface MilestoneProgress {
  /** The first Milestone the Learner hasn't reached yet; undefined once they have passed the last one. */
  next: Milestone | undefined;
  /** Immersion time still to go until `next`; 0 when there is no next Milestone. */
  remainingSeconds: number;
  /** 0 to 1, the share of the way from nothing to `next`; 1 when there is no next Milestone. */
  fraction: number;
}

/** The next Milestone for an amount of Immersion time. Reaching a threshold exactly counts as reaching it. */
export function nextMilestone(immersionSeconds: number): MilestoneProgress {
  const seconds = Math.max(0, immersionSeconds);
  const next = MILESTONES.find((milestone) => seconds < milestone.hours * 3600);
  if (!next) return { next: undefined, remainingSeconds: 0, fraction: 1 };
  const targetSeconds = next.hours * 3600;
  return { next, remainingSeconds: targetSeconds - seconds, fraction: seconds / targetSeconds };
}
