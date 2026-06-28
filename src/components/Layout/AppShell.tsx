import { BarChart3, CircleHelp, Settings as SettingsIcon, Timer, Users } from "lucide-react";
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
  hp: number | null;
  level: number | null;
  children: React.ReactNode;
}) {
  const headerDisplayName = displayName.trim() || "John Smith";
  const headerDividerClassName = "mx-auto h-px w-[380px] max-w-full shrink-0 rounded-full bg-[#d3d7de]";

  return (
    <div className="relative flex h-[600px] w-[420px] flex-col overflow-hidden bg-[var(--bg)] font-sans selection:bg-[var(--sky-soft)]">
      {/* MINIMAL TOP BAR */}
      <header className="shrink-0 px-6 pt-4 pb-5">
        <div className="text-center">
          <span className="sw-display-accent text-[14px] uppercase tracking-[0.18em] text-[var(--muted)]">Status</span>
        </div>
        <div className={`mt-3 ${headerDividerClassName}`} aria-hidden="true" />

        <div className="mt-4 flex items-start justify-between">
          <div className="flex flex-col">
            <h1 className="sw-display-accent max-w-[190px] text-lg tracking-tight text-[var(--ink)]">
              {headerDisplayName}
            </h1>
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col items-end">
              <span className="sw-display-accent text-[9px] text-[var(--muted)] uppercase">Health</span>
              <span className={`sw-display-accent text-sm ${hp !== null && hp < 0 ? "text-[var(--danger)]" : "text-[var(--leaf)]"}`}>
                {hp === null ? "--" : `${hp} HP`}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="sw-display-accent text-[9px] text-[var(--muted)] uppercase">Level</span>
              <span className="sw-display-accent text-sm text-[var(--sky-dark)]">
                {level === null ? "LVL --" : `LVL ${level}`}
              </span>
            </div>
          </div>
        </div>
        <div className={`mt-4 ${headerDividerClassName}`} aria-hidden="true" />
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto px-6 pt-2 pb-24 scrollbar-hide">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {children}
        </div>
      </main>

      {/* BOTTOM NAVIGATION */}
      <nav className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-2xl border border-[var(--border)] bg-[var(--paper)]/80 p-1.5 shadow-2xl backdrop-blur-xl ring-1 ring-black/5">
        <button
          onClick={() => onTabChange("log")}
          className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all duration-200 ${
            activeTab === "log" ? "bg-[var(--sky)] text-white shadow-inner" : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-black/5"
          }`}
        >
          <Timer className="h-5 w-5" />
          <span className="sw-display-accent mt-1 text-[8px] uppercase tracking-wider">Log</span>
        </button>
        <button
          onClick={() => onTabChange("stats")}
          className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all duration-200 ${
            activeTab === "stats" ? "bg-[var(--sky)] text-white shadow-inner" : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-black/5"
          }`}
        >
          <BarChart3 className="h-5 w-5" />
          <span className="sw-display-accent mt-1 text-[8px] uppercase tracking-wider">Stats</span>
        </button>
        <button
          onClick={() => onTabChange("friends")}
          className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all duration-200 ${
            activeTab === "friends" ? "bg-[var(--sky)] text-white shadow-inner" : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-black/5"
          }`}
        >
          <Users className="h-5 w-5" />
          <span className="sw-display-accent mt-1 text-[8px] uppercase tracking-wider">Friends</span>
        </button>
        <button
          onClick={() => onTabChange("info")}
          className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all duration-200 ${
            activeTab === "info" ? "bg-[var(--sky)] text-white shadow-inner" : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-black/5"
          }`}
        >
          <CircleHelp className="h-5 w-5" />
          <span className="sw-display-accent mt-1 text-[8px] uppercase tracking-wider">Info</span>
        </button>
        <button
          onClick={() => onTabChange("settings")}
          className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all duration-200 ${
            activeTab === "settings" ? "bg-[var(--sky)] text-white shadow-inner" : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-black/5"
          }`}
        >
          <SettingsIcon className="h-5 w-5" />
          <span className="sw-display-accent mt-1 text-[8px] uppercase tracking-wider">Settings</span>
        </button>
      </nav>
    </div>
  );
}
