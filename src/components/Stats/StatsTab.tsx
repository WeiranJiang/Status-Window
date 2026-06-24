import { Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { calculateHP, calculateHoursBySubject, calculateLevel, calculateTotalStudySeconds, formatDurationShort, formatSessionDate } from "../../lib/stats";
import type { Profile, StudySession, Subject } from "../../types";

interface StatsTabProps {
  profile: Profile | null;
  subjects: Subject[];
  sessions: StudySession[];
  radarSubjectIds: string[];
  onRadarSelectionChange: (next: string[]) => void;
  onSaveDisplayName: (displayName: string) => Promise<void>;
  onAddSubject: (payload: { name: string; color: string }) => Promise<void>;
  onUpdateSubject: (subjectId: string, payload: { name: string; color: string }) => Promise<void>;
  onArchiveSubject: (subjectId: string) => Promise<void>;
}

export function StatsTab({
  profile,
  subjects,
  sessions,
  radarSubjectIds,
  onRadarSelectionChange,
  onSaveDisplayName,
  onAddSubject,
  onUpdateSubject,
  onArchiveSubject,
}: StatsTabProps) {
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectColor, setNewSubjectColor] = useState("#8cb7ff");
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingColor, setEditingColor] = useState("#8cb7ff");

  const totalSeconds = calculateTotalStudySeconds(sessions);
  const totalHours = totalSeconds / 3600;
  const level = calculateLevel(totalSeconds);
  const hp = calculateHP([...sessions].sort((left, right) => left.start_time.localeCompare(right.start_time)));
  const hoursBySubject = useMemo(() => calculateHoursBySubject(sessions, subjects), [sessions, subjects]);

  const radarData = hoursBySubject.filter((item) => radarSubjectIds.includes(item.subjectId));
  const recentSessions = sessions.slice(0, 8);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
  }, [profile?.display_name]);

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-[1.3fr_0.9fr] gap-4 max-[560px]:grid-cols-1">
        <div className="rounded-[24px] border border-white/60 bg-white/85 p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Profile</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">{profile?.display_name || "Set your display name"}</h2>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-slate-900 px-3 py-4 text-white">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-300">Hours</div>
              <div className="mt-2 text-2xl font-bold">{totalHours.toFixed(totalHours >= 100 ? 0 : 1)}</div>
            </div>
            <div className="rounded-2xl bg-white px-3 py-4 text-slate-800 shadow-card">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Level</div>
              <div className="mt-2 text-2xl font-bold">{level}</div>
            </div>
            <div className="rounded-2xl bg-white px-3 py-4 text-slate-800 shadow-card">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">HP</div>
              <div className="mt-2 text-2xl font-bold">{hp}</div>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Display name"
              className="flex-1 rounded-2xl border border-white/70 bg-white px-4 py-3 text-sm text-slate-800 shadow-card outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
            />
            <button
              type="button"
              onClick={() => void onSaveDisplayName(displayName)}
              className="flex items-center gap-2 rounded-2xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            >
              <Save className="h-4 w-4" />
              Save
            </button>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/60 bg-white/85 p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Daily HP Rule</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Reach one total hour on a calendar day to gain HP. Miss it and you lose HP, even if there were a few short sessions.
          </p>
          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            The system checks every day from your first saved session through today using your local timezone.
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-white/60 bg-white/85 p-4 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Subjects</p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">Manage your study tracks</h3>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {subjects.filter((subject) => subject.is_active).length} active
          </div>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-3 max-[560px]:grid-cols-1">
          <input
            value={newSubjectName}
            onChange={(event) => setNewSubjectName(event.target.value)}
            placeholder="Add a subject"
            className="rounded-2xl border border-white/70 bg-white px-4 py-3 text-sm text-slate-800 shadow-card outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
          />
          <input
            value={newSubjectColor}
            onChange={(event) => setNewSubjectColor(event.target.value)}
            type="color"
            className="h-[52px] w-full rounded-2xl border border-white/70 bg-white px-2 py-2 shadow-card"
          />
          <button
            type="button"
            onClick={() => {
              if (!newSubjectName.trim()) {
                return;
              }
              void onAddSubject({ name: newSubjectName.trim(), color: newSubjectColor });
              setNewSubjectName("");
            }}
            className="flex items-center justify-center gap-2 rounded-2xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {subjects.map((subject) => {
            const editing = editingSubjectId === subject.id;
            const stats = hoursBySubject.find((entry) => entry.subjectId === subject.id);

            return (
              <div key={subject.id} className="rounded-2xl border border-white/70 bg-white/75 px-4 py-3 shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: subject.color ?? "#94a3b8" }} />
                    {editing ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                        <input value={editingColor} onChange={(event) => setEditingColor(event.target.value)} type="color" className="h-10 rounded-xl border border-slate-200 px-1" />
                      </div>
                    ) : (
                      <div>
                        <div className="truncate font-semibold text-slate-900">{subject.name}</div>
                        <div className="text-xs text-slate-500">{stats ? `${stats.totalHours.toFixed(1)}h logged` : "No sessions yet"}</div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {editing ? (
                      <button
                        type="button"
                        onClick={() => {
                          void onUpdateSubject(subject.id, { name: editingName, color: editingColor });
                          setEditingSubjectId(null);
                        }}
                        className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                      >
                        Save
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSubjectId(subject.id);
                          setEditingName(subject.name);
                          setEditingColor(subject.color ?? "#8cb7ff");
                        }}
                        className="rounded-xl bg-slate-100 p-2 text-slate-700 transition hover:bg-slate-200"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void onArchiveSubject(subject.id)}
                      className="rounded-xl bg-rose-100 p-2 text-rose-700 transition hover:bg-rose-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[24px] border border-white/60 bg-white/85 p-4 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Radar Chart</p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">How your time is spread</h3>
          </div>
          <div className="text-xs text-slate-500">Select at least 3 subjects</div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {subjects
            .filter((subject) => subject.is_active)
            .map((subject) => {
              const checked = radarSubjectIds.includes(subject.id);
              return (
                <label
                  key={subject.id}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    checked ? "border-slate-900 bg-slate-900 text-white" : "border-white/70 bg-white text-slate-600"
                  }`}
                >
                  <input
                    checked={checked}
                    onChange={() => {
                      const next = checked
                        ? radarSubjectIds.filter((id) => id !== subject.id)
                        : [...radarSubjectIds, subject.id];
                      onRadarSelectionChange(next);
                    }}
                    type="checkbox"
                    className="hidden"
                  />
                  {subject.name}
                </label>
              );
            })}
        </div>

        <div className="mt-4 h-[260px] rounded-[24px] bg-slate-50 p-3">
          {radarData.length >= 3 ? (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#d9e6ff" />
                <PolarAngleAxis dataKey="name" tick={{ fill: "#475569", fontSize: 11 }} />
                <Radar dataKey="totalHours" stroke="#4f46e5" fill="#8cb7ff" fillOpacity={0.55} />
                <Tooltip
                  formatter={(value) => [`${Number(value ?? 0).toFixed(2)} hours`, "Logged"]}
                  contentStyle={{ borderRadius: 16, border: "1px solid #dbeafe", boxShadow: "0 10px 30px rgba(79, 70, 229, 0.15)" }}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">
              Select at least 3 subjects to show the radar chart.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[24px] border border-white/60 bg-white/85 p-4 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">History</p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">Recent sessions</h3>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {recentSessions.length > 0 ? (
            recentSessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/75 px-4 py-3 shadow-card">
                <div>
                  <div className="font-semibold text-slate-900">{session.subject?.name ?? "Archived Subject"}</div>
                  <div className="text-xs text-slate-500">{formatSessionDate(session.start_time)}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-800">{formatDurationShort(session.duration_seconds)}</div>
                  <div className="text-xs capitalize text-slate-500">{session.mode}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Your status is still loading... start a session to begin.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
