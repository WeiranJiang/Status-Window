import { getStorageItem, setStorageItem } from "./storage";
import { toLocalDateKey } from "./stats";
import type { StudyChallenge, StudySession } from "../types";

const CHALLENGES_STORAGE_KEY_PREFIX = "status-window-challenges:";

function getChallengesStorageKey(userId: string) {
  return `${CHALLENGES_STORAGE_KEY_PREFIX}${userId}`;
}

function sanitizePositiveInt(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.round(value));
}

export async function loadChallenges(userId: string) {
  const raw = await getStorageItem(getChallengesStorageKey(userId));
  if (!raw) {
    return [] as StudyChallenge[];
  }

  try {
    const parsed = JSON.parse(raw) as StudyChallenge[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function upsertChallenge(
  userId: string,
  payload: {
    subject_id: string;
    daily_target_minutes: number;
    hp_penalty: number;
  },
) {
  const current = await loadChallenges(userId);
  const existing = current.find((challenge) => challenge.subject_id === payload.subject_id);

  const nextChallenge: StudyChallenge = existing
    ? {
        ...existing,
        daily_target_minutes: sanitizePositiveInt(payload.daily_target_minutes, existing.daily_target_minutes),
        hp_penalty: sanitizePositiveInt(payload.hp_penalty, existing.hp_penalty),
      }
    : {
        id: crypto.randomUUID(),
        user_id: userId,
        subject_id: payload.subject_id,
        daily_target_minutes: sanitizePositiveInt(payload.daily_target_minutes, 60),
        hp_penalty: sanitizePositiveInt(payload.hp_penalty, 1),
        created_at: new Date().toISOString(),
      };

  const next = [...current.filter((challenge) => challenge.subject_id !== payload.subject_id), nextChallenge].sort((left, right) =>
    left.created_at.localeCompare(right.created_at),
  );

  await setStorageItem(getChallengesStorageKey(userId), JSON.stringify(next));
  return next;
}

export async function deleteChallenge(userId: string, challengeId: string) {
  const current = await loadChallenges(userId);
  const next = current.filter((challenge) => challenge.id !== challengeId);
  await setStorageItem(getChallengesStorageKey(userId), JSON.stringify(next));
  return next;
}

export function calculateChallengePenalty(sessions: StudySession[], challenges: StudyChallenge[], today = new Date()) {
  if (challenges.length === 0) {
    return {
      totalPenalty: 0,
      breakdown: [] as Array<{
        challengeId: string;
        subjectId: string;
        missedDays: number;
        totalPenalty: number;
      }>,
    };
  }

  const subjectDaySeconds = sessions.reduce((map, session) => {
    const key = `${session.subject_id}:${toLocalDateKey(session.start_time)}`;
    map.set(key, (map.get(key) ?? 0) + session.duration_seconds);
    return map;
  }, new Map<string, number>());

  const lastCompletedDay = new Date(today);
  lastCompletedDay.setHours(0, 0, 0, 0);
  lastCompletedDay.setDate(lastCompletedDay.getDate() - 1);

  const breakdown = challenges.map((challenge) => {
    const startDay = new Date(challenge.created_at);
    startDay.setHours(0, 0, 0, 0);

    let missedDays = 0;
    const cursor = new Date(startDay);
    while (cursor <= lastCompletedDay) {
      const key = `${challenge.subject_id}:${toLocalDateKey(cursor.toISOString())}`;
      const studiedSeconds = subjectDaySeconds.get(key) ?? 0;
      if (studiedSeconds < challenge.daily_target_minutes * 60) {
        missedDays += 1;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      challengeId: challenge.id,
      subjectId: challenge.subject_id,
      missedDays,
      totalPenalty: missedDays * challenge.hp_penalty,
    };
  });

  return {
    totalPenalty: breakdown.reduce((sum, item) => sum + item.totalPenalty, 0),
    breakdown,
  };
}

export function getChallengeTodayStatus(
  sessions: StudySession[],
  challenge: StudyChallenge,
  today = new Date(),
) {
  const todayKey = toLocalDateKey(today.toISOString());
  const studiedSeconds = sessions
    .filter((session) => session.subject_id === challenge.subject_id && toLocalDateKey(session.start_time) === todayKey)
    .reduce((sum, session) => sum + session.duration_seconds, 0);

  const studiedMinutes = Math.floor(studiedSeconds / 60);
  const remainingMinutes = Math.max(challenge.daily_target_minutes - studiedMinutes, 0);
  const completed = remainingMinutes === 0;

  return {
    completed,
    studiedMinutes,
    remainingMinutes,
    targetMinutes: challenge.daily_target_minutes,
  };
}
