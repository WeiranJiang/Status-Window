import { LogOut, Volume2 } from "lucide-react";
import { COLOR_SCHEMES } from "../../lib/constants";
import type { UserSettings } from "../../types";

export function SettingsTab({
  settings,
  onUpdateSettings,
  onLogout,
}: {
  settings: UserSettings;
  onUpdateSettings: (updates: Partial<UserSettings>) => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-[24px] border border-white/60 bg-white/85 p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Settings</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">Shape your workspace</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Themes, sound behavior, and the always-visible timer all live here.
        </p>
      </section>

      <section className="rounded-[24px] border border-white/60 bg-white/85 p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Theme</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => void onUpdateSettings({ theme: "light" })}
            className={`rounded-2xl border px-4 py-3 text-left transition ${
              settings.theme === "light" ? "border-slate-900 bg-slate-900 text-white" : "border-white/70 bg-white text-slate-700"
            }`}
          >
            <div className="font-semibold">Light Mode</div>
            <p className="mt-1 text-xs opacity-80">Bright notebook paper with soft shadows.</p>
          </button>
          <button
            type="button"
            onClick={() => void onUpdateSettings({ theme: "dark", color_scheme: "dark-mode" })}
            className={`rounded-2xl border px-4 py-3 text-left transition ${
              settings.theme === "dark" ? "border-slate-900 bg-slate-900 text-white" : "border-white/70 bg-white text-slate-700"
            }`}
          >
            <div className="font-semibold">Dark Mode</div>
            <p className="mt-1 text-xs opacity-80">Midnight desk setup with glowing focus notes.</p>
          </button>
        </div>
      </section>

      <section className="rounded-[24px] border border-white/60 bg-white/85 p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Color Scheme</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {COLOR_SCHEMES.map((scheme) => {
            const selected = settings.color_scheme === scheme.id;
            return (
              <button
                key={scheme.id}
                type="button"
                onClick={() =>
                  void onUpdateSettings({
                    color_scheme: scheme.id,
                    theme: scheme.id === "dark-mode" ? "dark" : settings.theme === "dark" ? "light" : settings.theme,
                  })
                }
                className={`rounded-2xl border px-3 py-3 text-left transition ${
                  selected ? "border-slate-900 bg-slate-900 text-white" : "border-white/70 bg-white text-slate-700"
                }`}
              >
                <div className="mb-3 flex gap-2">
                  <span className="h-5 w-5 rounded-full" style={{ backgroundColor: scheme.accent }} />
                  <span className="h-5 w-5 rounded-full" style={{ backgroundColor: scheme.accentSoft }} />
                  <span className="h-5 w-5 rounded-full" style={{ backgroundColor: scheme.surface }} />
                </div>
                <div className="font-semibold">{scheme.name}</div>
                <div className="mt-1 text-xs opacity-80">{scheme.description}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[24px] border border-white/60 bg-white/85 p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Sounds</p>
        <div className="mt-3 space-y-3">
          {[
            {
              key: "button_sounds_enabled" as const,
              label: "Button clicks",
            },
            {
              key: "tab_sounds_enabled" as const,
              label: "Tab switches",
            },
            {
              key: "timer_sound_enabled" as const,
              label: "Timer completion",
            },
          ].map((item) => (
            <label key={item.key} className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/70 px-4 py-3">
              <span className="text-sm font-semibold text-slate-700">{item.label}</span>
              <input
                type="checkbox"
                checked={settings[item.key]}
                onChange={(event) => void onUpdateSettings({ [item.key]: event.target.checked })}
                className="h-4 w-4 accent-slate-900"
              />
            </label>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-white/70 bg-white/70 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Volume2 className="h-4 w-4" />
              Volume
            </div>
            <div className="text-xs text-slate-500">{Math.round(settings.volume * 100)}%</div>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.volume}
            onChange={(event) => void onUpdateSettings({ volume: Number(event.target.value) })}
            className="mt-3 w-full accent-slate-900"
          />
        </div>
      </section>

      <section className="rounded-[24px] border border-white/60 bg-white/85 p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Always-Visible Mode</p>
        <label className="mt-3 flex items-center justify-between rounded-2xl border border-white/70 bg-white/70 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-700">Keep the side panel timer open</div>
            <div className="mt-1 text-xs text-slate-500">Pause, resume, and stop while you keep working in Chrome.</div>
          </div>
          <input
            type="checkbox"
            checked={settings.floating_mode_enabled}
            onChange={(event) => void onUpdateSettings({ floating_mode_enabled: event.target.checked })}
            className="h-4 w-4 accent-slate-900"
          />
        </label>
      </section>

      <button
        type="button"
        onClick={() => void onLogout()}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 transition hover:-translate-y-0.5"
      >
        <LogOut className="h-4 w-4" />
        Log out
      </button>
    </div>
  );
}
