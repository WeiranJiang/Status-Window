import type { StudySession, Subject } from "../types";

export const formatSeconds = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
};

export const formatDurationShort = (totalSeconds: number) => {
  const hours = totalSeconds / 3600;
  if (hours >= 1) {
    return `${hours.toFixed(hours >= 10 ? 0 : 1)}h`;
  }

  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  return `${minutes}m`;
};

export const formatSessionDate = (isoString: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoString));

export const toLocalDateKey = (isoString: string) => {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const calculateTotalStudySeconds = (sessions: StudySession[]) =>
  sessions.reduce((sum, session) => sum + session.duration_seconds, 0);

export const calculateLevel = (totalSeconds: number) => {
  const hours = totalSeconds / 3600;
  return Math.round(hours / 1000);
};

export const calculateHoursBySubject = (sessions: StudySession[], subjects: Subject[]) => {
  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));

  return Array.from(
    sessions.reduce((map, session) => {
      const current = map.get(session.subject_id) ?? 0;
      map.set(session.subject_id, current + session.duration_seconds);
      return map;
    }, new Map<string, number>()),
  )
    .map(([subjectId, totalSeconds]) => ({
      subjectId,
      name: subjectMap.get(subjectId)?.name ?? "Archived Subject",
      color: subjectMap.get(subjectId)?.color ?? "#93a0b6",
      totalSeconds,
      totalHours: Number((totalSeconds / 3600).toFixed(2)),
    }))
    .sort((left, right) => right.totalSeconds - left.totalSeconds);
};

export const calculateHP = (sessions: StudySession[], today = new Date()) => {
  if (sessions.length === 0) {
    return 0;
  }

  const sessionsByDay = sessions.reduce((map, session) => {
    const key = toLocalDateKey(session.start_time);
    const current = map.get(key) ?? 0;
    map.set(key, current + session.duration_seconds);
    return map;
  }, new Map<string, number>());

  const firstDay = new Date(sessions[0].start_time);
  firstDay.setHours(0, 0, 0, 0);

  const endDay = new Date(today);
  endDay.setHours(0, 0, 0, 0);

  let hp = 0;
  const cursor = new Date(firstDay);

  while (cursor <= endDay) {
    const key = toLocalDateKey(cursor.toISOString());
    const total = sessionsByDay.get(key) ?? 0;
    hp += total >= 3600 ? 1 : -1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return hp;
};

export const getTimerSnapshot = (state: {
  active: boolean;
  mode: "stopwatch" | "timer" | null;
  paused: boolean;
  accumulatedMs: number;
  lastResumedAtMs: number | null;
  targetDurationMs: number | null;
}) => {
  if (!state.active || !state.mode) {
    return { elapsedMs: 0, remainingMs: state.targetDurationMs, completed: false };
  }

  const runningMs = state.paused || !state.lastResumedAtMs ? 0 : Date.now() - state.lastResumedAtMs;
  const elapsedMs = state.accumulatedMs + runningMs;
  const remainingMs =
    state.mode === "timer" && state.targetDurationMs !== null
      ? Math.max(state.targetDurationMs - elapsedMs, 0)
      : null;

  return {
    elapsedMs,
    remainingMs,
    completed: state.mode === "timer" && remainingMs === 0,
  };
};
