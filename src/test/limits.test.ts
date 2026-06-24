import { describe, it, expect } from "vitest";
import { getTimerSnapshot } from "../lib/stats";

describe("Timer limits and snapshots", () => {
  it("calculates snapshot for stopwatch with 6-hour limit correctly", () => {
    const sixHoursMs = 6 * 60 * 60 * 1000;
    const state = {
      active: true,
      mode: "stopwatch" as const,
      paused: false,
      accumulatedMs: 0,
      lastResumedAtMs: Date.now() - 3600 * 1000, // 1 hour ago
      targetDurationMs: sixHoursMs,
    };

    const snapshot = getTimerSnapshot(state);
    
    // Stopwatch elapsedMs should be 1 hour
    expect(snapshot.elapsedMs).toBeGreaterThanOrEqual(3600000);
    expect(snapshot.elapsedMs).toBeLessThan(3601000);
    
    // Stopwatch remainingMs should be null (as per getTimerSnapshot logic)
    expect(snapshot.remainingMs).toBeNull();
    
    // Stopwatch should not be completed yet
    expect(snapshot.completed).toBe(false);
  });

  it("identifies completed status for timer at limit", () => {
    const limitMs = 30 * 60 * 1000; // 30 mins
    const state = {
      active: true,
      mode: "timer" as const,
      paused: false,
      accumulatedMs: limitMs,
      lastResumedAtMs: Date.now(),
      targetDurationMs: limitMs,
    };

    const snapshot = getTimerSnapshot(state);
    expect(snapshot.elapsedMs).toBeGreaterThanOrEqual(limitMs);
    expect(snapshot.remainingMs).toBe(0);
    expect(snapshot.completed).toBe(true);
  });
});
