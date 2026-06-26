import { describe, expect, it } from "vitest";
import { calculateChallengePenalty, getChallengeTodayStatus } from "../lib/challenges";
import type { StudyChallenge, StudySession } from "../types";

const makeSession = (overrides: Partial<StudySession>): StudySession => ({
  id: crypto.randomUUID(),
  user_id: "user-1",
  subject_id: "subject-1",
  mode: "stopwatch",
  start_time: "2026-06-20T12:00:00.000Z",
  end_time: "2026-06-20T13:00:00.000Z",
  duration_seconds: 3600,
  created_at: "2026-06-20T13:00:00.000Z",
  ...overrides,
});

const makeChallenge = (overrides: Partial<StudyChallenge>): StudyChallenge => ({
  id: crypto.randomUUID(),
  user_id: "user-1",
  subject_id: "subject-1",
  daily_target_minutes: 30,
  hp_penalty: 2,
  created_at: "2026-06-20T09:00:00.000Z",
  ...overrides,
});

describe("challenge penalties", () => {
  it("returns zero when there are no challenges", () => {
    const result = calculateChallengePenalty([], []);
    expect(result.totalPenalty).toBe(0);
    expect(result.breakdown).toHaveLength(0);
  });

  it("applies whole-number penalties only after a missed day has fully ended", () => {
    const sessions = [
      makeSession({
        start_time: "2026-06-20T12:00:00.000Z",
        duration_seconds: 3600,
      }),
      makeSession({
        id: crypto.randomUUID(),
        start_time: "2026-06-21T12:00:00.000Z",
        duration_seconds: 20 * 60,
      }),
    ];

    const challenge = makeChallenge({});
    const result = calculateChallengePenalty(sessions, [challenge], new Date("2026-06-22T18:00:00.000Z"));

    expect(result.totalPenalty).toBe(2);
    expect(result.breakdown[0]).toMatchObject({
      challengeId: challenge.id,
      subjectId: challenge.subject_id,
      missedDays: 1,
      totalPenalty: 2,
    });
  });

  it("reports whether today's challenge is complete yet", () => {
    const challenge = makeChallenge({
      daily_target_minutes: 45,
    });

    const notYet = getChallengeTodayStatus(
      [
        makeSession({
          start_time: "2026-06-22T10:00:00.000Z",
          duration_seconds: 30 * 60,
        }),
      ],
      challenge,
      new Date("2026-06-22T18:00:00.000Z"),
    );

    expect(notYet).toMatchObject({
      completed: false,
      studiedMinutes: 30,
      remainingMinutes: 15,
      targetMinutes: 45,
    });

    const completed = getChallengeTodayStatus(
      [
        makeSession({
          start_time: "2026-06-22T10:00:00.000Z",
          duration_seconds: 50 * 60,
        }),
      ],
      challenge,
      new Date("2026-06-22T18:00:00.000Z"),
    );

    expect(completed).toMatchObject({
      completed: true,
      studiedMinutes: 50,
      remainingMinutes: 0,
      targetMinutes: 45,
    });
  });
});
