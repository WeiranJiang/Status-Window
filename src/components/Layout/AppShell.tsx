import { BarChart3, Settings as SettingsIcon, Timer } from "lucide-react";
import type { AppTab } from "../../types";

export function AppShell({
  activeTab,
  onTabChange,
  displayName,
  hp,
  level,
  children,
}: {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  displayName: string;
  hp: number;
  level: number;
  children: React.ReactNode;
}) {
  const headerDisplayName = displayName.trim() || "John Smith";

  return (
    <div className="relative flex h-[600px] w-[420px] flex-col overflow-hidden bg-[var(--bg)] font-sans selection:bg-[var(--sky-soft)]">
      {/* MINIMAL TOP BAR */}
      <header className="shrink-0 border-b border-[var(--border)]/70 px-6 pt-4 pb-5">
        <div className="text-center">
          <span className="text-[14px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Status</span>
        </div>

        <div className="mt-4 flex items-start justify-between">
          <div className="flex flex-col">
            <h1 className="max-w-[190px] text-lg font-black tracking-tight text-[var(--ink)]">
              {headerDisplayName}
            </h1>
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-bold text-[var(--muted)] uppercase">Health</span>
              <span className={`text-sm font-black ${hp < 0 ? "text-[var(--danger)]" : "text-[var(--leaf)]"}`}>
                {hp} HP
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-bold text-[var(--muted)] uppercase">Level</span>
              <span className="text-sm font-black text-[var(--sky-dark)]">
                LVL {level}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto px-6 pt-4 pb-24 scrollbar-hide">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {children}
        </div>
      </main>

      {/* BOTTOM NAVIGATION */}
      <nav className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-2xl border border-[var(--border)] bg-[var(--paper)]/80 p-1.5 shadow-2xl backdrop-blur-xl ring-1 ring-black/5">
        <button
          onClick={() => onTabChange("log")}
          className={`flex h-12 w-14 flex-col items-center justify-center rounded-xl transition-all duration-200 ${
            activeTab === "log" ? "bg-[var(--sky)] text-white shadow-inner" : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-black/5"
          }`}
        >
          <Timer className="h-5 w-5" />
          <span className="mt-1 text-[9px] font-bold uppercase tracking-wider">Start</span>
        </button>
        <button
          onClick={() => onTabChange("stats")}
          className={`flex h-12 w-14 flex-col items-center justify-center rounded-xl transition-all duration-200 ${
            activeTab === "stats" ? "bg-[var(--sky)] text-white shadow-inner" : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-black/5"
          }`}
        >
          <BarChart3 className="h-5 w-5" />
          <span className="mt-1 text-[9px] font-bold uppercase tracking-wider">Stats</span>
        </button>
        <button
          onClick={() => onTabChange("settings")}
          className={`flex h-12 w-14 flex-col items-center justify-center rounded-xl transition-all duration-200 ${
            activeTab === "settings" ? "bg-[var(--sky)] text-white shadow-inner" : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-black/5"
          }`}
        >
          <SettingsIcon className="h-5 w-5" />
          <span className="mt-1 text-[9px] font-bold uppercase tracking-wider">Settings</span>
        </button>
      </nav>
    </div>
  );
}
