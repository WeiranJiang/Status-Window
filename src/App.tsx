import type { Session, User } from "@supabase/supabase-js";
import { LoaderCircle, Settings2 } from "lucide-react";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { AuthScreen } from "./components/Auth/AuthScreen";
import { AppShell } from "./components/Layout/AppShell";
import { ToastStack, type ToastItem } from "./components/Layout/ToastStack";
import { LogTab } from "./components/Log/LogTab";
import { SettingsTab } from "./components/Settings/SettingsTab";
import { StatsTab } from "./components/Stats/StatsTab";
import { acknowledgeTimerNotice, getTimerState, hasChromeRuntime, openGoogleOAuthWindow, pauseTimer, resumeTimer, setFloatingMode, startTimer, stopTimer, getExtensionRedirectUrl } from "./lib/chrome";
import { COLOR_SCHEMES, DEFAULT_SETTINGS, MINIMUM_CONFIRM_SAVE_SECONDS } from "./lib/constants";
import { playSound } from "./lib/sounds";
import { archiveSubject, addSubject, ensureInitialUserData, loadDashboardData, renameSubject, saveStudySession, signInWithEmail, signUpWithEmail, updateProfileDisplayName, updateUserSettings } from "./lib/setup";
import { formatDurationShort } from "./lib/stats";
import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";
import type { AppTab, AuthMode, DashboardData, SessionDraft, Subject, TimerDisplayState, UserSettings } from "./types";

const SETTINGS_CACHE_KEY = "status-window-settings";

export default function App() {
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>("log");
  const [timerState, setTimerState] = useState<TimerDisplayState | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [radarSubjectIds, setRadarSubjectIds] = useState<string[]>([]);
  const processedNoticeId = useRef<string | null>(null);

  const settings = dashboard?.settings ?? {
    id: "fallback",
    user_id: currentUser?.id ?? "fallback",
    created_at: new Date().toISOString(),
    ...DEFAULT_SETTINGS,
  };

  const colorScheme = useMemo(
    () => COLOR_SCHEMES.find((scheme) => scheme.id === settings.color_scheme) ?? COLOR_SCHEMES[0],
    [settings.color_scheme],
  );

  const pushToast = (toast: Omit<ToastItem, "id">) => {
    const nextToast = { id: crypto.randomUUID(), tone: "neutral" as const, ...toast };
    setToasts((current) => [...current, nextToast]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== nextToast.id));
    }, 4200);
  };

  const syncChromeSettingsCache = async (nextSettings: UserSettings) => {
    if (globalThis.chrome?.storage?.local) {
      await globalThis.chrome.storage.local.set({ [SETTINGS_CACHE_KEY]: nextSettings });
    }
  };

  const loadWorkspace = async (user: User) => {
    setDataLoading(true);
    try {
      await ensureInitialUserData(user);
      const nextDashboard = await loadDashboardData(user.id);
      startTransition(() => {
        setDashboard(nextDashboard);
        if (radarSubjectIds.length === 0) {
          setRadarSubjectIds(nextDashboard.subjects.filter((subject) => subject.is_active).slice(0, 4).map((subject) => subject.id));
        }
      });
      await syncChromeSettingsCache(nextDashboard.settings);
    } finally {
      setDataLoading(false);
    }
  };

  const syncTimer = async () => {
    if (!hasChromeRuntime) {
      setTimerState(null);
      return;
    }

    const response = await getTimerState();
    if (!response.ok || !response.data) {
      return;
    }

    setTimerState(response.data.timer.active ? response.data.timer : null);
    const notice = response.data.notice;
    if (notice && processedNoticeId.current !== notice.id) {
      processedNoticeId.current = notice.id;
      pushToast({
        tone: notice.saved ? "success" : "error",
        title: notice.saved
          ? `${notice.subjectName} finished and saved`
          : `${notice.subjectName} finished but needs attention`,
        description: notice.saved
          ? `${formatDurationShort(notice.durationSeconds)} added to your history.`
          : notice.errorMessage ?? "The timer finished, but the session could not be saved automatically.",
      });
      if (notice.saved && currentUser) {
        await loadWorkspace(currentUser);
      }
      await acknowledgeTimerNotice(notice.id);
      if (notice.saved && settings.timer_sound_enabled) {
        await playSound("completion", settings);
      }
    }
  };

  useEffect(() => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.style.setProperty("--sw-page", colorScheme.page);
      root.style.setProperty("--sw-surface", colorScheme.surface);
      root.style.setProperty("--sw-accent", colorScheme.accent);
      root.style.setProperty("--sw-accent-soft", colorScheme.accentSoft);
      root.style.setProperty("--sw-accent-strong", colorScheme.accentStrong);
      root.style.setProperty("--sw-ink", colorScheme.ink);
      root.style.setProperty("--sw-shadow", colorScheme.shadow);
      root.style.setProperty("--sw-border", colorScheme.border);
      root.classList.toggle("dark", settings.theme === "dark");
    }
  }, [colorScheme, settings.theme]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    let active = true;

    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active) {
        return;
      }

      if (error) {
        setAuthError(error.message);
      }

      setSession(data.session);
      setCurrentUser(data.session?.user ?? null);
      setAuthLoading(false);

      if (data.session?.user) {
        await loadWorkspace(data.session.user);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setCurrentUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        void loadWorkspace(nextSession.user);
      } else {
        setDashboard(null);
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    void syncTimer();
    const interval = window.setInterval(() => {
      void syncTimer();
    }, 1000);

    return () => window.clearInterval(interval);
  }, [currentUser, settings.timer_sound_enabled, settings.volume]);

  const persistSettings = async (updates: Partial<UserSettings>) => {
    if (!currentUser || !dashboard) {
      return;
    }

    const nextSettings = await updateUserSettings(currentUser.id, updates);
    setDashboard((current) => (current ? { ...current, settings: nextSettings } : current));
    await syncChromeSettingsCache(nextSettings);
    if (updates.floating_mode_enabled !== undefined) {
      await setFloatingMode(Boolean(updates.floating_mode_enabled));
    }
  };

  const handleTabChange = async (tab: AppTab) => {
    setActiveTab(tab);
    await playSound("tab", settings);
  };

  const handleAuthSubmit = async ({
    displayName,
    email,
    password,
  }: {
    displayName: string;
    email: string;
    password: string;
  }) => {
    setAuthBusy(true);
    setAuthError(null);

    try {
      if (authMode === "signup") {
        const response = await signUpWithEmail(email, password, displayName.trim());
        if (response.error) {
          throw response.error;
        }
        const showEasterEgg = Math.random() < 0.4;
        if (!response.data.session) {
          pushToast({
            tone: "success",
            title: "Account created",
            description: "Check your email if Supabase email confirmation is enabled.",
          });
        }
        if (showEasterEgg) {
          pushToast({
            tone: "neutral",
            title: "Nice to see you again!",
            description: "A tiny Status Window easter egg decided this was funny.",
          });
        }
      } else {
        const response = await signInWithEmail(email, password);
        if (response.error) {
          throw response.error;
        }
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleGoogleAuth = async () => {
    setAuthBusy(true);
    setAuthError(null);

    try {
      const redirectTo = getExtensionRedirectUrl() ?? window.location.origin;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: Boolean(getExtensionRedirectUrl()),
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (error) {
        throw error;
      }

      if (getExtensionRedirectUrl() && data.url) {
        const redirectedTo = await openGoogleOAuthWindow(data.url);
        const hash = redirectedTo.includes("#") ? redirectedTo.split("#")[1] : "";
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        if (!accessToken || !refreshToken) {
          throw new Error("Google login did not return a valid session.");
        }
        const sessionResult = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionResult.error) {
          throw sessionResult.error;
        }
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Google sign-in failed.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleStart = async ({
    subject,
    mode,
    durationMs,
  }: {
    subject: Subject;
    mode: "stopwatch" | "timer";
    durationMs: number | null;
  }) => {
    if (!session?.access_token || !session.refresh_token || !currentUser) {
      throw new Error("Please log in again before starting a timer.");
    }

    await playSound("button", settings);
    const response = await startTimer({
      mode,
      subjectId: subject.id,
      subjectName: subject.name,
      subjectColor: subject.color,
      targetDurationMs: durationMs,
      userId: currentUser.id,
      authAccessToken: session.access_token,
      authRefreshToken: session.refresh_token,
    });

    if (!response.ok || !response.data) {
      throw new Error(response.error ?? "Unable to start the timer.");
    }

    setTimerState(response.data);
  };

  const handlePause = async () => {
    await playSound("button", settings);
    const response = await pauseTimer();
    if (!response.ok || !response.data) {
      throw new Error(response.error ?? "Unable to pause the timer.");
    }
    setTimerState(response.data);
  };

  const handleResume = async () => {
    await playSound("button", settings);
    const response = await resumeTimer();
    if (!response.ok || !response.data) {
      throw new Error(response.error ?? "Unable to resume the timer.");
    }
    setTimerState(response.data);
  };

  const handleStop = async () => {
    await playSound("button", settings);
    const response = await stopTimer();
    if (!response.ok || !response.data) {
      throw new Error(response.error ?? "Unable to stop the timer.");
    }

    const durationSeconds = response.data.durationSeconds;
    const draft = response.data.draft;

    setTimerState(null);

    if (durationSeconds <= 0) {
      pushToast({
        tone: "neutral",
        title: "Session discarded",
        description: "Zero-second sessions are not saved.",
      });
      return;
    }

    if (
      durationSeconds < MINIMUM_CONFIRM_SAVE_SECONDS &&
      !window.confirm(`This session is only ${durationSeconds} seconds long. Save it anyway?`)
    ) {
      pushToast({
        tone: "neutral",
        title: "Short session skipped",
        description: "You can start again whenever you're ready.",
      });
      return;
    }

    const savedSession = await saveStudySession(draft);
    setDashboard((current) =>
      current
        ? {
            ...current,
            sessions: [savedSession, ...current.sessions],
          }
        : current,
    );
    pushToast({
      tone: "success",
      title: "Session saved",
      description: `${savedSession.subject?.name ?? "Session"} logged for ${formatDurationShort(savedSession.duration_seconds)}.`,
    });
  };

  const withTaskToast = async (task: () => Promise<void>) => {
    try {
      await task();
    } catch (error) {
      pushToast({
        tone: "error",
        title: "Something needs attention",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="status-window-shell overflow-hidden rounded-[28px] border border-white/60 bg-white/85 p-6 shadow-soft backdrop-blur-xl">
        <div className="flex min-h-[600px] flex-col justify-center">
          <div className="mx-auto max-w-sm rounded-[28px] border border-white/70 bg-white/75 p-6 text-center shadow-card">
            <Settings2 className="mx-auto h-10 w-10 text-slate-500" />
            <h1 className="mt-4 text-2xl font-bold text-slate-900">Status Window needs Supabase setup</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to a local
              <code> .env </code>
              file, then reload the extension build.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="status-window-shell flex min-h-[600px] items-center justify-center rounded-[28px] border border-white/60 bg-white/85 shadow-soft backdrop-blur-xl">
        <div className="flex items-center gap-3 text-slate-600">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          Loading Status Window...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <ToastStack toasts={toasts} />
        <AuthScreen
          loading={authBusy}
          mode={authMode}
          errorMessage={authError}
          onModeChange={setAuthMode}
          onEmailSubmit={handleAuthSubmit}
          onGoogleSubmit={handleGoogleAuth}
        />
      </>
    );
  }

  if (dataLoading || !dashboard) {
    return (
      <div className="status-window-shell flex min-h-[600px] items-center justify-center rounded-[28px] border border-white/60 bg-white/85 shadow-soft backdrop-blur-xl">
        <div className="flex items-center gap-3 text-slate-600">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          Syncing your dashboard...
        </div>
      </div>
    );
  }

  return (
    <>
      <ToastStack toasts={toasts} />
      <AppShell
        activeTab={activeTab}
        displayName={dashboard.profile?.display_name || currentUser.email || "Study Hero"}
        onTabChange={(tab) => {
          void withTaskToast(() => handleTabChange(tab));
        }}
      >
        {activeTab === "log" ? (
          <LogTab
            subjects={dashboard.subjects}
            activeTimer={timerState}
            onStart={(payload) => withTaskToast(() => handleStart(payload))}
            onPause={() => withTaskToast(handlePause)}
            onResume={() => withTaskToast(handleResume)}
            onStop={() => withTaskToast(handleStop)}
          />
        ) : null}

        {activeTab === "stats" ? (
          <StatsTab
            profile={dashboard.profile}
            subjects={dashboard.subjects}
            sessions={dashboard.sessions}
            radarSubjectIds={radarSubjectIds}
            onRadarSelectionChange={setRadarSubjectIds}
            onSaveDisplayName={(displayName) =>
              withTaskToast(async () => {
                if (!currentUser || !displayName.trim()) {
                  throw new Error("Please enter a display name first.");
                }
                const profile = await updateProfileDisplayName(currentUser.id, displayName.trim());
                setDashboard((current) => (current ? { ...current, profile } : current));
                pushToast({ tone: "success", title: "Display name updated" });
              })
            }
            onAddSubject={({ name, color }) =>
              withTaskToast(async () => {
                if (!currentUser) {
                  return;
                }
                const subject = await addSubject(currentUser.id, name, color);
                setDashboard((current) =>
                  current
                    ? {
                        ...current,
                        subjects: [...current.subjects, subject],
                      }
                    : current,
                );
              })
            }
            onUpdateSubject={(subjectId, payload) =>
              withTaskToast(async () => {
                const subject = await renameSubject(subjectId, payload.name, payload.color);
                setDashboard((current) =>
                  current
                    ? {
                        ...current,
                        subjects: current.subjects.map((item) => (item.id === subjectId ? subject : item)),
                      }
                    : current,
                );
              })
            }
            onArchiveSubject={(subjectId) =>
              withTaskToast(async () => {
                const subject = await archiveSubject(subjectId);
                setDashboard((current) =>
                  current
                    ? {
                        ...current,
                        subjects: current.subjects.map((item) => (item.id === subjectId ? subject : item)),
                      }
                    : current,
                );
                setRadarSubjectIds((current) => current.filter((id) => id !== subjectId));
              })
            }
          />
        ) : null}

        {activeTab === "settings" ? (
          <SettingsTab
            settings={settings}
            onUpdateSettings={(updates) =>
              withTaskToast(async () => {
                await persistSettings(updates);
              })
            }
            onLogout={() =>
              withTaskToast(async () => {
                await supabase.auth.signOut();
                setDashboard(null);
                setTimerState(null);
              })
            }
          />
        ) : null}
      </AppShell>
    </>
  );
}
