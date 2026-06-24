import { describe, expect, it } from "vitest";
import { calculateHP, calculateLevel, formatSeconds, toLocalDateKey } from "../lib/stats";
import type { StudySession } from "../types";

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

describe("stats utilities", () => {
  it("formats seconds as HH:MM:SS", () => {
    expect(formatSeconds(3661)).toBe("01:01:01");
  });

  it("calculates level from total study time", () => {
    expect(calculateLevel(1_800_000)).toBe(1);
    expect(calculateLevel(7_200_000)).toBe(2);
  });

  it("groups dates in local time", () => {
    expect(toLocalDateKey("2026-06-20T23:45:00.000Z")).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("calculates HP across consecutive days", () => {
    const sessions = [
      makeSession({
        start_time: "2026-06-20T12:00:00.000Z",
        duration_seconds: 3600,
      }),
      makeSession({
        id: crypto.randomUUID(),
        start_time: "2026-06-22T12:00:00.000Z",
        duration_seconds: 1800,
      }),
    ];

    const hp = calculateHP(sessions, new Date("2026-06-22T18:00:00.000Z"));
    expect(hp).toBe(-1);
  });
});
