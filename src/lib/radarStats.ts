import type { StudySession, Subject } from "../types";

export interface SubjectHours {
  subjectId: string;
  subjectName: string;
  color: string | null;
  totalSeconds: number;
  totalHours: number;
}

/**
 * Calculate total study hours per subject from a list of sessions.
 * Subjects with no sessions produce 0 hours (never undefined).
 */
export function calculateSubjectHours(
  subjects: Subject[],
  sessions: StudySession[],
): SubjectHours[] {
  const secondsMap = new Map<string, number>();

  for (const session of sessions) {
    if (!session.subject_id) continue;
    secondsMap.set(
      session.subject_id,
      (secondsMap.get(session.subject_id) ?? 0) + (session.duration_seconds || 0),
    );
  }

  return subjects
    .filter((s) => s.is_active)
    .map((subject) => {
      const totalSeconds = secondsMap.get(subject.id) ?? 0;
      return {
        subjectId: subject.id,
        subjectName: subject.name,
        color: subject.color ?? null,
        totalSeconds,
        totalHours: totalSeconds / 3600,
      };
    });
}
