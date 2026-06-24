import { memo, useMemo } from "react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import {
  calculateHP,
  calculateHoursBySubject,
  calculateLevel,
  calculateTotalStudySeconds,
} from "../../lib/stats";
import type { StudySession, Subject } from "../../types";

interface StatsTabProps {
  subjects: Subject[];
  sessions: StudySession[];
  radarSubjectIds: string[];
}

export const StatsTab = memo(function StatsTab({
  subjects,
  sessions,
  radarSubjectIds,
}: StatsTabProps) {
  const totalSeconds = useMemo(() => calculateTotalStudySeconds(sessions), [sessions]);
  const totalHours = useMemo(() => totalSeconds / 3600, [totalSeconds]);
  const level = useMemo(() => calculateLevel(totalSeconds), [totalSeconds]);
  const hp = useMemo(() => calculateHP(sessions), [sessions]);
  const hoursBySubject = useMemo(() => calculateHoursBySubject(sessions, subjects), [sessions, subjects]);
  
  const radarData = useMemo(
    () => hoursBySubject.filter((item) => radarSubjectIds.includes(item.subjectId)),
    [hoursBySubject, radarSubjectIds],
  );

  return (
    <div className="flex flex-col gap-10 py-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* PRIMARY METRICS GRID */}
      <section className="grid grid-cols-2 gap-4">
        <div className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-5 shadow-sm transition-all hover:shadow-md">
          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)]">Focus Hours</span>
          <span className="mt-1 text-3xl font-black tracking-tight text-[var(--ink)]">
            {totalHours.toFixed(1)}
          </span>
        </div>
        <div className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-5 shadow-sm transition-all hover:shadow-md">
          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)]">Survival HP</span>
          <span className={`mt-1 text-3xl font-black tracking-tight ${hp < 0 ? "text-[var(--danger)]" : "text-[var(--leaf)]"}`}>
            {hp}
          </span>
        </div>
      </section>

      {/* RADAR CHART */}
      <section>
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Radar Chart</span>
        <div className="mt-4 flex h-80 w-full items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--paper)]/70 p-4">
          {radarData.length >= 3 ? (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="#ece4d6" />
                <PolarAngleAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 800, fill: "#6b5d4f" }} />
                <Radar
                  name="Value"
                  dataKey="totalHours"
                  stroke="var(--sky)"
                  fill="var(--sky)"
                  fillOpacity={0.4}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-[10px] font-bold text-[var(--muted)] opacity-50 uppercase tracking-widest">
              Select at least 3 subjects to show the radar chart
            </p>
          )}
        </div>
      </section>
    </div>
  );
});
