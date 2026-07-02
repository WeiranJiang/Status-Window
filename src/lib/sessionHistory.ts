import type { StudySession } from "../types";

export function applySessionHistoryReduction(
  sessions: StudySession[],
  sessionId: string,
  updatedSession: StudySession | null,
) {
  if (updatedSession) {
    return sessions.map((session) => (session.id === sessionId ? updatedSession : session));
  }

  return sessions.filter((session) => session.id !== sessionId);
}
