import { ChartNoAxesCombined, Cog, NotebookPen } from "lucide-react";
import type { AppTab } from "../../types";

const tabs: Array<{ id: AppTab; label: string; icon: typeof NotebookPen }> = [
  { id: "log", label: "Log", icon: NotebookPen },
  { id: "stats", label: "Stats", icon: ChartNoAxesCombined },
  { id: "settings", label: "Settings", icon: Cog },
];

export function AppShell({
  activeTab,
  displayName,
  onTabChange,
  children,
}: {
  activeTab: AppTab;
  displayName: string;
  onTabChange: (tab: AppTab) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="status-window-shell relative overflow-hidden rounded-[28px] border border-white/60 bg-white/80 shadow-soft backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.9),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(255,255,255,0.65),_transparent_30%)]" />
      <div className="relative grid h-full min-h-[600px] grid-cols-[108px_1fr] max-[460px]:grid-cols-1">
        <aside className="border-r border-white/60 bg-white/55 px-4 py-5 max-[460px]:border-r-0 max-[460px]:border-b">
          <div className="rounded-3xl bg-[rgba(255,255,255,0.7)] p-3 shadow-card">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Status Window</p>
            <h1 className="mt-2 font-display text-xl font-bold text-slate-800">Cozy focus log</h1>
            <div className="mt-4 rounded-2xl border border-white/70 bg-white/80 px-3 py-2 text-xs text-slate-500">
              <div className="font-semibold text-slate-700">{displayName}</div>
              <div className="mt-1">Ready to add another session.</div>
            </div>
          </div>

          <nav className="mt-5 flex gap-2 max-[460px]:mt-4 max-[460px]:overflow-x-auto">
            {tabs.map(({ id, label, icon: Icon }) => {
              const selected = id === activeTab;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onTabChange(id)}
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-3 py-3 text-left transition ${
                    selected
                      ? "bg-slate-800 text-white shadow-card"
                      : "bg-white/70 text-slate-600 hover:-translate-y-0.5 hover:bg-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-semibold">{label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="relative min-h-[600px] overflow-y-auto px-5 py-5 max-[460px]:px-4">{children}</main>
      </div>
    </div>
  );
}
