import { COLOR_SCHEMES } from "../../lib/constants";
import { Archive, Check, LogOut, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { COMMON_TIME_ZONE_OPTIONS, getSystemTimeZone, getTimeZoneLabel, normalizeTimeZoneInput } from "../../lib/timezones";
import type { Subject, UserSettings } from "../../types";

const sectionHeadingClassName = "sw-display-accent text-[12px] uppercase tracking-widest text-[var(--muted)]";

function PreferenceCheck({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border shadow-sm transition-all active:scale-95 ${
        checked
          ? "border-[var(--sky-soft)] bg-[var(--paper)] text-[var(--sky)]"
          : "border-[var(--border)] bg-[var(--paper)] text-transparent hover:border-[var(--sky)] hover:bg-[color-mix(in_srgb,var(--paper)_76%,var(--sky-soft))]"
      }`}
    >
      <Check className="h-4 w-4" />
    </button>
  );
}

function PreferenceActionButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center justify-center rounded-full bg-[var(--sky)] px-4 text-[10px] font-black uppercase tracking-wider text-white shadow-sm transition-all hover:bg-[var(--sky-dark)] active:scale-95"
    >
      {label}
    </button>
  );
}

function ColorDotInput({
  value,
  onChange,
  label,
  size = "md",
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  size?: "md" | "lg";
}) {
  const dimensions = size === "lg" ? "h-10 w-10" : "h-9 w-9";
  const dotSize = size === "lg" ? "h-6 w-6" : "h-5 w-5";

  return (
    <label
      className={`relative flex ${dimensions} shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--border)] bg-[var(--paper)] shadow-sm transition-all hover:border-[var(--sky)] hover:shadow-md`}
      aria-label={label}
    >
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={label}
      />
      <span
        className={`${dotSize} rounded-full border border-black/5`}
        style={{ backgroundColor: value }}
      />
    </label>
  );
}

export function SettingsTab({
  settings,
  subjects,
  initialDisplayName,
  onUpdateSettings,
  onOpenTimer,
  onAddSubject,
  onUpdateSubject,
  onArchiveSubject,
  onDeleteSubject,
  onDeleteAccount,
  onSaveDisplayName,
  onLogout,
}: {
  settings: UserSettings;
  subjects: Subject[];
  initialDisplayName: string;
  onUpdateSettings: (updates: Partial<UserSettings>) => Promise<void>;
  onOpenTimer: () => Promise<void>;
  onAddSubject: (payload: { name: string; color: string }) => Promise<void>;
  onUpdateSubject: (subjectId: string, payload: { name: string; color: string }) => Promise<void>;
  onArchiveSubject: (subjectId: string, shouldArchive: boolean) => Promise<void>;
  onDeleteSubject: (subjectId: string) => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onSaveDisplayName: (displayName: string) => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const orderedSubjects = [...subjects].sort((left, right) => {
    if (left.is_active === right.is_active) {
      return left.created_at.localeCompare(right.created_at);
    }

    return left.is_active ? -1 : 1;
  });
  const [newSubName, setNewSubName] = useState("");
  const [newSubColor, setNewSubColor] = useState("#5b9bd5");
  const [dispName, setDispName] = useState(initialDisplayName);
  const [subjectDrafts, setSubjectDrafts] = useState<Record<string, string>>({});
  const [subjectColorDrafts, setSubjectColorDrafts] = useState<Record<string, string>>({});
  const [timeZoneDraft, setTimeZoneDraft] = useState(settings.time_zone ?? "");
  const [timeZoneError, setTimeZoneError] = useState<string | null>(null);

  useEffect(() => {
    setDispName(initialDisplayName);
  }, [initialDisplayName]);

  useEffect(() => {
    setTimeZoneDraft(settings.time_zone ?? "");
    setTimeZoneError(null);
  }, [settings.time_zone]);

  return (
    <div className="flex flex-col gap-6 pt-1 pb-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* IDENTITY */}
      <section>
        <span className={sectionHeadingClassName}>Profile</span>
        <div className="mt-4 flex items-center gap-2">
          <input
            value={dispName}
            onChange={(e) => setDispName(e.target.value)}
            className="sw-display-accent flex-1 rounded-xl border border-[var(--border)] bg-[var(--paper)] px-4 py-2.5 text-xs text-[var(--ink)] focus:border-[var(--sky)] focus:ring-1 focus:ring-[var(--sky)]"
            placeholder="Name"
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
        <span className={sectionHeadingClassName}>Subjects</span>
        <div className="mt-3 flex flex-col gap-2">
          {orderedSubjects.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-2 rounded-xl border p-3 shadow-sm transition-all ${
                s.is_active
                  ? "border-[var(--border)] bg-[var(--paper)]"
                  : "border-[color-mix(in_srgb,var(--border)_88%,var(--muted))] bg-[color-mix(in_srgb,var(--paper)_84%,var(--muted))] opacity-70"
              }`}
            >
              <ColorDotInput
                value={subjectColorDrafts[s.id] ?? s.color ?? "#5b9bd5"}
                onChange={(value) =>
                  setSubjectColorDrafts((current) => ({
                    ...current,
                    [s.id]: value,
                  }))
                }
                label={`Change color for subject ${s.name}`}
              />
              <input
                value={subjectDrafts[s.id] ?? s.name}
                onChange={(e) =>
                  setSubjectDrafts((current) => ({
                    ...current,
                    [s.id]: e.target.value,
                  }))
                }
                className="sw-display-accent flex-1 rounded-xl border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-xs text-[var(--ink)] focus:border-[var(--sky)] focus:ring-1 focus:ring-[var(--sky)]"
                aria-label={`Rename subject ${s.name}`}
              />
              {!s.is_active ? (
                <span className="sw-display-accent rounded-full bg-[color-mix(in_srgb,var(--muted)_18%,var(--paper))] px-2 py-1 text-[8px] uppercase tracking-wide text-[var(--muted)]">
                  Archived
                </span>
              ) : null}
              <button
                onClick={async () => {
                  const nextName = (subjectDrafts[s.id] ?? s.name).trim();
                  const nextColor = subjectColorDrafts[s.id] ?? s.color ?? "#5b9bd5";

                  if (!nextName) {
                    return;
                  }

                  if (nextName === s.name && nextColor === (s.color ?? "#5b9bd5")) {
                    return;
                  }

                  await onUpdateSubject(s.id, {
                    name: nextName,
                    color: nextColor,
                  });

                  setSubjectDrafts((current) => ({
                    ...current,
                    [s.id]: nextName,
                  }));
                  setSubjectColorDrafts((current) => ({
                    ...current,
                    [s.id]: nextColor,
                  }));
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--sky)] text-white shadow-md active:scale-95 transition-all"
                aria-label={`Save subject ${s.name}`}
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  if (
                    !window.confirm(
                      s.is_active
                        ? `Archive "${s.name}"? It will stop showing up in active subject lists and radar selection, but your saved data will stay.`
                        : `Bring "${s.name}" back from archived subjects? It will show up again in active subject lists and radar selection.`,
                    )
                  ) {
                    return;
                  }

                  void onArchiveSubject(s.id, s.is_active);
                }}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all ${
                  s.is_active
                    ? "text-[var(--muted)] hover:bg-[var(--sky-soft)] hover:text-[var(--sky-dark)]"
                    : "bg-[var(--sky-soft)] text-[var(--sky-dark)] hover:bg-[var(--sky)] hover:text-white"
                }`}
                aria-label={`${s.is_active ? "Archive" : "Restore"} subject ${s.name}`}
              >
                <Archive className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  if (
                    !window.confirm(
                      `Delete "${s.name}" and all of its saved study data? This will permanently remove its sessions and cannot be undone.`,
                    )
                  ) {
                    return;
                  }

                  void onDeleteSubject(s.id);
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-red-400 transition-all hover:bg-red-50 hover:text-red-500"
                aria-label={`Delete subject ${s.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          
          <div className="mt-2 flex items-center gap-2">
            <ColorDotInput
              value={newSubColor}
              onChange={setNewSubColor}
              label="Choose color for new subject"
              size="lg"
            />
            <input
              value={newSubName}
              onChange={(e) => setNewSubName(e.target.value)}
              placeholder="Subject"
              className="sw-display-accent flex-1 rounded-xl border border-[var(--border)] bg-[var(--paper)] px-4 py-2.5 text-xs text-[var(--ink)] focus:border-[var(--sky)] focus:ring-1 focus:ring-[var(--sky)]"
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
        <span className={sectionHeadingClassName}>Color Scheme</span>
        <div className="mt-3 grid grid-cols-2 gap-3">
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
                <div className="sw-display-accent text-base text-[var(--ink)]">{scheme.name}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* OPTIONS */}
      <section>
        <span className={sectionHeadingClassName}>Preferences</span>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--paper)]/70 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[var(--ink)]">Visible Timer</span>
              <span className="text-[9px] font-bold text-[var(--muted)] uppercase">Open the side panel timer</span>
            </div>
            <PreferenceActionButton
              label="Open Timer"
              onClick={() => void onOpenTimer()}
            />
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--paper)]/70 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[var(--ink)]">Time Zone</span>
              <span className="text-[9px] font-bold uppercase text-[var(--muted)]">
                Used for daily stats, challenge resets, and friends&apos; today totals
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                list="status-window-time-zones"
                value={timeZoneDraft}
                onChange={(event) => {
                  setTimeZoneDraft(event.target.value);
                  setTimeZoneError(null);
                }}
                placeholder={`System default (${getSystemTimeZone()})`}
                className="sw-display-accent flex-1 rounded-xl border border-[var(--border)] bg-[var(--paper)] px-4 py-2.5 text-xs text-[var(--ink)] focus:border-[var(--sky)] focus:ring-1 focus:ring-[var(--sky)]"
                aria-label="Preferred time zone"
              />
              <button
                type="button"
                onClick={async () => {
                  const normalized = normalizeTimeZoneInput(timeZoneDraft);
                  if (timeZoneDraft.trim().length > 0 && !normalized) {
                    setTimeZoneError("Use a real time zone like EST, UTC, or America/New_York.");
                    return;
                  }

                  await onUpdateSettings({ time_zone: normalized });
                  setTimeZoneDraft(normalized ?? "");
                  setTimeZoneError(null);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--sky)] text-white shadow-md active:scale-95 transition-all"
                aria-label="Save time zone"
              >
                <Check className="h-5 w-5" />
              </button>
            </div>
            <datalist id="status-window-time-zones">
              {COMMON_TIME_ZONE_OPTIONS.filter((option) => option.value).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              <option value="EST">EST</option>
              <option value="CST">CST</option>
              <option value="MST">MST</option>
              <option value="PST">PST</option>
              <option value="UTC">UTC</option>
            </datalist>
            <div className="mt-2 flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--muted)]">
                Current: {getTimeZoneLabel(settings.time_zone)}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--muted)]">
                Leave blank to follow this device automatically
              </span>
              {timeZoneError ? (
                <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--danger)]">
                  {timeZoneError}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--paper)]/70 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[var(--ink)]">Sound Effects</span>
              <span className="text-[9px] font-bold text-[var(--muted)] uppercase">Timer completion alerts</span>
            </div>
            <PreferenceCheck
              checked={settings.timer_sound_enabled}
              onToggle={() => void onUpdateSettings({ timer_sound_enabled: !settings.timer_sound_enabled })}
              label="Toggle sound effects"
            />
          </div>
        </div>
      </section>

      {/* SIGN OUT */}
      <section className="mb-12">
        <div className="flex flex-col gap-3">
          <button
            onClick={() => void onLogout()}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-red-100 bg-red-50 py-4 text-xs font-black uppercase tracking-widest text-red-500 shadow-sm transition-all hover:bg-red-100 active:scale-95"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                !window.confirm(
                  "Delete your account and all of your saved data? This cannot be undone.",
                )
              ) {
                return;
              }

              if (
                !window.confirm(
                  "Are you absolutely sure? Your study history, challenges, subjects, friends, and settings will be permanently deleted.",
                )
              ) {
                return;
              }

              void onDeleteAccount();
            }}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-red-200 bg-white py-4 text-xs font-black uppercase tracking-widest text-red-600 shadow-sm transition-all hover:bg-red-50 active:scale-95"
          >
            <Trash2 className="h-4 w-4" />
            Delete account
          </button>
        </div>
      </section>
    </div>
  );
}
