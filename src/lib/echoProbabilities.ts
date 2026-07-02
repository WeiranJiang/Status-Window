import type { InitialEchoBranch, NonNormalFollowupBranch } from "../types/echo";

export const initialBranches: ReadonlyArray<{ id: InitialEchoBranch; probability: number }> = [
  { id: "normal_restore", probability: 0.4 },
  { id: "minor_fakeout_restore", probability: 0.2 },
  { id: "hint_message", probability: 0.2 },
  { id: "ten_second_hint", probability: 0.1 },
  { id: "corrupted_rare", probability: 0.05 },
  { id: "recognition_rare", probability: 0.05 },
];

export const nonNormalFollowupBranches: ReadonlyArray<{ id: NonNormalFollowupBranch; probability: number }> = [
  { id: "level_10_hint", probability: 0.5 },
  { id: "be_careful", probability: 0.4 },
  { id: "weak_signal", probability: 0.1 },
];

export function chooseWeightedBranch<T extends string>(
  branches: ReadonlyArray<{ id: T; probability: number }>,
  rng: () => number = Math.random,
): T {
  const total = branches.reduce((sum, branch) => sum + branch.probability, 0);
  if (Math.abs(total - 1) > 0.0001) {
    throw new Error(`Weighted branch probabilities must total 1. Received ${total.toFixed(4)}.`);
  }

  const roll = Math.min(Math.max(rng(), 0), 0.999999999999);
  let cursor = 0;

  for (const branch of branches) {
    cursor += branch.probability;
    if (roll < cursor) {
      return branch.id;
    }
  }

  return branches[branches.length - 1].id;
}
