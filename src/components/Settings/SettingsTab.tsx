import { COLOR_SCHEMES } from "../../lib/constants";
import { Check, LogOut, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Subject, UserSettings } from "../../types";

export function SettingsTab({
  settings,
  subjects,
  initialDisplayName,
  onUpdateSettings,
  onAddSubject,
  onUpdateSubject,
  onArchiveSubject,
  onSaveDisplayName,
  onLogout,
}: {
  settings: UserSettings;
  subjects: Subject[];
  initialDisplayName: string;
  onUpdateSettings: (updates: Partial<UserSettings>) => Promise<void>;
  onAddSubject: (payload: { name: string; color: string }) => Promise<void>;
  onUpdateSubject: (subjectId: string, payload: { name: string; color: string }) => Promise<void>;
  onArchiveSubject: (subjectId: string) => Promise<void>;
  onSaveDisplayName: (displayName: string) => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const activeSubjects = subjects.filter((s) => s.is_active);
  const [newSubName, setNewSubName] = useState("");
  const [newSubColor, setNewSubColor] = useState("#5b9bd5");
  const [dispName, setDispName] = useState(initialDisplayName);
  const [subjectDrafts, setSubjectDrafts] = useState<Record<string, string>>({});

  return (
    <div className="flex flex-col gap-10 py-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* IDENTITY */}
      <section>
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Profile</span>
        <div className="mt-4 flex items-center gap-2">
          <input
            value={dispName}
            onChange={(e) => setDispName(e.target.value)}
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--paper)] px-4 py-2.5 text-xs font-bold text-[var(--ink)] focus:border-[var(--sky)] focus:ring-1 focus:ring-[var(--sky)]"
            placeholder="Display Name"
          />
          <button
            onClick={() => void onSaveDisplayName(dispName)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--sky)] text-white shadow-md active:scale-95 transition-all"
          >
            <Check className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* SUBJECTS */}
      <section>
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Subjects</span>
        <div className="mt-4 flex flex-col gap-2">
          {activeSubjects.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--paper)] p-3 shadow-sm">
              <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color ?? "#5b9bd5" }} />
              <input
                value={subjectDrafts[s.id] ?? s.name}
                onChange={(e) =>
                  setSubjectDrafts((current) => ({
                    ...current,
                    [s.id]: e.target.value,
                  }))
                }
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-xs font-bold text-[var(--ink)] focus:border-[var(--sky)] focus:ring-1 focus:ring-[var(--sky)]"
                aria-label={`Rename subject ${s.name}`}
              />
              <button
                onClick={async () => {
                  const nextName = (subjectDrafts[s.id] ?? s.name).trim();
                  if (!nextName || nextName === s.name) {
                    return;
                  }

                  await onUpdateSubject(s.id, {
                    name: nextName,
                    color: s.color ?? "#5b9bd5",
                  });

                  setSubjectDrafts((current) => ({
                    ...current,
                    [s.id]: nextName,
                  }));
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--sky)] text-white shadow-md active:scale-95 transition-all"
                aria-label={`Save subject ${s.name}`}
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => void onArchiveSubject(s.id)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-red-400 transition-all hover:bg-red-50 hover:text-red-500"
                aria-label={`Archive subject ${s.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          
          <div className="mt-2 flex items-center gap-2">
            <input
              type="color"
              value={newSubColor}
              onChange={(e) => setNewSubColor(e.target.value)}
              className="h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-[var(--border)] p-0"
            />
            <input
              value={newSubName}
              onChange={(e) => setNewSubName(e.target.value)}
              placeholder="Subject"
              className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--paper)] px-4 py-2.5 text-xs font-bold text-[var(--ink)] focus:border-[var(--sky)] focus:ring-1 focus:ring-[var(--sky)]"
            />
            <button
              onClick={async () => {
                if (newSubName) {
                  await onAddSubject({ name: newSubName, color: newSubColor });
                  setNewSubName("");
                }
              }}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--ink)] text-white shadow-md active:scale-95 transition-all"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      {/* COLOR SCHEME */}
      <section>
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Color Scheme</span>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {COLOR_SCHEMES.slice(0, 4).map((scheme) => {
            const active = settings.color_scheme === scheme.id;
            return (
              <button
                key={scheme.id}
                onClick={() => void onUpdateSettings({ color_scheme: scheme.id, theme: "light" })}
                className={`rounded-2xl border p-3 text-left transition-all ${
                  active
                    ? "border-[var(--sky)] bg-[var(--sky-soft)] shadow-md ring-1 ring-[var(--sky)]"
                    : "border-[var(--border)] bg-[var(--paper)] hover:shadow-sm"
                }`}
              >
                <div className="mb-3 flex gap-2">
                  <span className="h-4 w-4 rounded-full border border-black/5" style={{ backgroundColor: scheme.bg }} />
                  <span className="h-4 w-4 rounded-full border border-black/5" style={{ backgroundColor: scheme.paper }} />
                  <span className="h-4 w-4 rounded-full border border-black/5" style={{ backgroundColor: scheme.accent }} />
                </div>
                <div className="text-xs font-black text-[var(--ink)]">{scheme.name}</div>
                <div className="mt-1 text-[10px] font-bold leading-4 text-[var(--muted)]">{scheme.description}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* OPTIONS */}
      <section>
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Preferences</span>
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--paper)]/70 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[var(--ink)]">Floating Mode</span>
              <span className="text-[9px] font-bold text-[var(--muted)] uppercase">Sidepanel always open</span>
            </div>
            <input
              type="checkbox"
              checked={settings.floating_mode_enabled}
              onChange={(e) => void onUpdateSettings({ floating_mode_enabled: e.target.checked })}
              className="h-5 w-5 rounded border-[var(--border)] text-[var(--sky)] focus:ring-[var(--sky)]"
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--paper)]/70 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[var(--ink)]">Sound Effects</span>
              <span className="text-[9px] font-bold text-[var(--muted)] uppercase">Timer completion alerts</span>
            </div>
            <input
              type="checkbox"
              checked={settings.timer_sound_enabled}
              onChange={(e) => void onUpdateSettings({ timer_sound_enabled: e.target.checked })}
              className="h-5 w-5 rounded border-[var(--border)] text-[var(--sky)] focus:ring-[var(--sky)]"
            />
          </div>
        </div>
      </section>

      {/* SIGN OUT */}
      <section className="mb-12">
        <button
          onClick={() => void onLogout()}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-red-100 bg-red-50 py-4 text-xs font-black uppercase tracking-widest text-red-500 shadow-sm transition-all hover:bg-red-100 active:scale-95"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </section>
    </div>
  );
}
