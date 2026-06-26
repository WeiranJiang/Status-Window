import type { Session, User } from "@supabase/supabase-js";
import { LoaderCircle, RotateCw, Settings2 } from "lucide-react";
import { lazy, startTransition, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthScreen } from "./components/Auth/AuthScreen";
import { FriendsTab } from "./components/Friends/FriendsTab";
import { InfoTab } from "./components/Info/InfoTab";
import { AppShell } from "./components/Layout/AppShell";
import { ToastStack, type ToastItem } from "./components/Layout/ToastStack";
import { LogTab } from "./components/Log/LogTab";
import { SettingsTab } from "./components/Settings/SettingsTab";
import { acknowledgeTimerNotice, getTimerState, hasChromeRuntime, pauseTimer, resumeTimer, setFloatingMode, startTimer, stopTimer } from "./lib/chrome";
import { calculateChallengePenalty, deleteChallenge, loadChallenges, upsertChallenge } from "./lib/challenges";
import { signInWithGoogle } from "./lib/auth";
import { COLOR_SCHEMES, DEFAULT_SETTINGS, MINIMUM_CONFIRM_SAVE_SECONDS } from "./lib/constants";
import { claimEmailFriendInvites } from "./lib/friends";
import { playSound } from "./lib/sounds";
import {
  archiveSubject,
  addSubject,
  ensureInitialUserData,
  loadCoreDashboardData,
  loadStatsSessions,
  renameSubject,
  saveStudySession,
  signInWithEmail,
  signUpWithEmail,
  updateProfileDisplayName,
  updateUserSettings,
} from "./lib/setup";
import { calculateHP, calculateLevel, calculateTotalStudySeconds, formatDurationShort } from "./lib/stats";
import { isChromeExtension } from "./lib/authRedirect";
import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";
import type { AppTab, AuthMode, DashboardCoreData, StudyChallenge, Subject, StudySession, TimerDisplayState, UserSettings } from "./types";

const LazyStatsTab = lazy(() => import("./components/Stats/StatsTab").then(({ StatsTab }) => ({ default: StatsTab })));
const SETTINGS_CACHE_KEY = "status-window-settings";
const CORE_CACHE_KEY_PREFIX = "status-window-core-cache:";
const LOADING_THEME: Omit<UserSettings, "id" | "user_id" | "created_at"> = {
  ...DEFAULT_SETTINGS,
  color_scheme: "warm-cream",
};

function readCoreCache(userId: string): DashboardCoreData | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const cached = window.localStorage.getItem(`${CORE_CACHE_KEY_PREFIX}${userId}`);
    return cached ? (JSON.parse(cached) as DashboardCoreData) : null;
  } catch {
    return null;
  }
}

function writeCoreCache(userId: string, data: DashboardCoreData) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(`${CORE_CACHE_KEY_PREFIX}${userId}`, JSON.stringify(data));
  } catch {
    // Ignore cache write failures and keep the live UI responsive.
  }
}

function clearCoreCache(userId?: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (userId) {
      window.localStorage.removeItem(`${CORE_CACHE_KEY_PREFIX}${userId}`);
      return;
    }

    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(CORE_CACHE_KEY_PREFIX)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore cache clear failures.
  }
}

const renderInPopupViewport = (content: React.ReactNode) => (
  <div className={isChromeExtension() ? "popup-surface-host" : "dev-preview-shell"}>
    <div className="status-window-popup">{content}</div>
  </div>
);

function PanelLoadingState({
  label,
  description,
  retryLabel,
  onRetry,
  hint,
}: {
  label: string;
  description: string;
  retryLabel?: string;
  onRetry?: () => void;
  hint?: React.ReactNode;
}) {
  return (
    <section className="sw-card sw-card-center h-full p-6">
      <LoaderCircle className="h-5 w-5 animate-spin text-[var(--sky-dark)]" />
      <h2 className="sw-card-title mt-3">{label}</h2>
      <p className="sw-copy mt-2 max-w-sm">{description}</p>
      {hint ? <div className="sw-note mt-4 max-w-sm text-left">{hint}</div> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="sw-button sw-button-primary mt-4 inline-flex items-center"
        >
          <RotateCw className="h-4 w-4" />
          {retryLabel ?? "Retry"}
        </button>
      ) : null}
    </section>
  );
}

function LogTabSkeleton() {
  return (
    <div className="flex h-full flex-col gap-3">
      <section className="sw-card p-4">
        <div className="animate-pulse">
          <div className="sw-skeleton h-3 w-12" />
          <div className="sw-skeleton mt-3 h-6 w-56" />
          <div className="mt-4 flex flex-wrap gap-2">
            <div className="sw-skeleton h-10 w-24" />
            <div className="sw-skeleton h-10 w-28" />
            <div className="sw-skeleton h-10 w-20" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="sw-skeleton h-24" />
            <div className="sw-skeleton h-24" />
          </div>
          <div className="sw-skeleton mt-3 h-12" />
          <div className="sw-skeleton mt-3 h-11" />
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [coreData, setCoreData] = useState<DashboardCoreData | null>(null);
  const [sessions, setSessions] = useState<StudySession[] | null>(null);
  const [challenges, setChallenges] = useState<StudyChallenge[]>([]);
  const [coreLoading, setCoreLoading] = useState(false);
  const [coreError, setCoreError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>("log");
  const [timerState, setTimerState] = useState<TimerDisplayState | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [radarSubjectIds, setRadarSubjectIds] = useState<string[]>([]);
  const processedNoticeId = useRef<string | null>(null);
  const currentUserRef = useRef<User | null>(null);
  const coreDataRef = useRef<DashboardCoreData | null>(null);
  const sessionsRef = useRef<StudySession[] | null>(null);
  const activeTabRef = useRef<AppTab>("log");
  const initializedUserIdsRef = useRef<Set<string>>(new Set());
  const coreLoadPromiseRef = useRef<Promise<void> | null>(null);
  const statsLoadPromiseRef = useRef<Promise<void> | null>(null);
  const lastAuthSessionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    coreDataRef.current = coreData;
  }, [coreData]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (!currentUser?.id) {
      setChallenges([]);
      return;
    }

    let active = true;
    void loadChallenges(currentUser.id).then((nextChallenges) => {
      if (active) {
        setChallenges(nextChallenges);
      }
    });

    return () => {
      active = false;
    };
  }, [currentUser?.id]);

  const settings = coreData?.settings ?? {
    ...LOADING_THEME,
    id: "fallback",
    user_id: currentUser?.id ?? "fallback",
    created_at: new Date().toISOString(),
  };

  const activeColorScheme = useMemo(
    () => COLOR_SCHEMES.find((scheme) => scheme.id === settings.color_scheme) ?? COLOR_SCHEMES[0],
    [settings.color_scheme],
  );

  const pushToast = useCallback((toast: Omit<ToastItem, "id">) => {
    const nextToast = { id: crypto.randomUUID(), tone: "neutral" as const, ...toast };
    setToasts((current) => [...current, nextToast]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== nextToast.id));
    }, 4200);
  }, []);

  useEffect(() => {
    if (!currentUser?.id || !currentUser.email) {
      return;
    }

    let active = true;

    void claimEmailFriendInvites(currentUser)
      .then((claimedCount) => {
        if (!active || claimedCount === 0) {
          return;
        }

        pushToast({
          tone: "success",
          title: claimedCount === 1 ? "Friend invite arrived" : "Friend invites arrived",
          description:
            claimedCount === 1
              ? "A friend request is waiting for you in Friends."
              : `${claimedCount} friend requests are waiting for you in Friends.`,
        });
      })
      .catch(() => {
        // Keep auth flow resilient even if invite claiming fails.
      });

    return () => {
      active = false;
    };
  }, [currentUser, pushToast]);

  const syncChromeSettingsCache = useCallback(async (nextSettings: UserSettings) => {
    if (globalThis.chrome?.storage?.local) {
      await globalThis.chrome.storage.local.set({ [SETTINGS_CACHE_KEY]: nextSettings });
    }
  }, []);

  const ensureUserInitialized = useCallback(async (user: User) => {
    if (initializedUserIdsRef.current.has(user.id)) {
      return;
    }

    await ensureInitialUserData(user);
    initializedUserIdsRef.current.add(user.id);
  }, []);

  const loadStatsData = useCallback(
    async (user: User, options: { force?: boolean } = {}) => {
      if (!options.force && sessionsRef.current !== null) {
        return;
      }

      if (statsLoadPromiseRef.current && !options.force) {
        return statsLoadPromiseRef.current;
      }

      setStatsError(null);

      const loadPromise = (async () => {
        try {
          const nextSessions = await loadStatsSessions(user.id);

          if (currentUserRef.current?.id !== user.id) {
            return;
          }

          startTransition(() => {
            setSessions(nextSessions);
          });
        } catch (error) {
          if (currentUserRef.current?.id === user.id) {
            setStatsError(error instanceof Error ? error.message : "Unable to sync your stats right now.");
          }
          throw error;
        }
      })();

      statsLoadPromiseRef.current = loadPromise.finally(() => {
        if (statsLoadPromiseRef.current === loadPromise) {
          statsLoadPromiseRef.current = null;
        }
      });

      return statsLoadPromiseRef.current;
    },
    [],
  );

  const loadCoreData = useCallback(
    async (user: User, options: { force?: boolean } = {}) => {
      if (coreLoadPromiseRef.current && !options.force) {
        return coreLoadPromiseRef.current;
      }

      if (coreDataRef.current) {
        setCoreLoading(false);
      } else {
        setCoreLoading(true);
      }
      setCoreError(null);

      const loadPromise = (async () => {
        try {
          await ensureUserInitialized(user);
          const nextCoreData = await loadCoreDashboardData(user.id);

          if (currentUserRef.current?.id !== user.id) {
            return;
          }

          startTransition(() => {
            setCoreData(nextCoreData);
            setRadarSubjectIds((current) =>
              current.length > 0
                ? current.filter((subjectId) => nextCoreData.subjects.some((subject) => subject.id === subjectId && subject.is_active))
                : nextCoreData.subjects.filter((subject) => subject.is_active).slice(0, 3).map((subject) => subject.id),
            );
          });

          writeCoreCache(user.id, nextCoreData);
          await syncChromeSettingsCache(nextCoreData.settings);
        } catch (error) {
          if (currentUserRef.current?.id === user.id) {
            const message = error instanceof Error ? error.message : "Unable to load your dashboard.";
            console.error("Status Window core load failed:", error);
            setCoreError(message);
          }
          throw error;
        } finally {
          setCoreLoading(false);
        }
      })();

      coreLoadPromiseRef.current = loadPromise.finally(() => {
        if (coreLoadPromiseRef.current === loadPromise) {
          coreLoadPromiseRef.current = null;
        }
      });

      return coreLoadPromiseRef.current;
    },
    [ensureUserInitialized, syncChromeSettingsCache],
  );

  useEffect(() => {
    if (!currentUser || coreData || coreError || coreLoading) {
      return;
    }

    void loadCoreData(currentUser).catch(() => {
      // The error is already stored in component state for the UI.
    });
  }, [coreData, coreError, coreLoading, currentUser, loadCoreData]);

  const syncTimer = useCallback(async () => {
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

      if (notice.saved && currentUserRef.current && sessionsRef.current !== null) {
        try {
          await loadStatsData(currentUserRef.current, { force: true });
        } catch {
          // Keep the existing local data visible if background refresh fails.
        }
      }

      await acknowledgeTimerNotice(notice.id);

      if (notice.saved && settings.timer_sound_enabled) {
        await playSound("completion", settings);
      }
    }
  }, [loadStatsData, pushToast, settings]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.style.setProperty("--bg", activeColorScheme.bg);
      root.style.setProperty("--paper", activeColorScheme.paper);
      root.style.setProperty("--ink", activeColorScheme.ink);
      root.style.setProperty("--ink-soft", activeColorScheme.inkSoft);
      root.style.setProperty("--sky-soft", activeColorScheme.accentSoft);
      root.style.setProperty("--sky", activeColorScheme.accent);
      root.style.setProperty("--sky-dark", activeColorScheme.accentStrong);
      root.style.setProperty("--leaf", activeColorScheme.success);
      root.style.setProperty("--muted", activeColorScheme.muted);
      root.style.setProperty("--danger", activeColorScheme.danger);
      root.style.setProperty("--border", activeColorScheme.border);
    }
  }, [activeColorScheme]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    let active = true;

    const applySession = (nextSession: Session | null) => {
      if (!active) {
        return;
      }

      const previousUserId = currentUserRef.current?.id ?? null;
      const nextSessionKey = nextSession ? `${nextSession.user.id}:${nextSession.access_token}` : "signed-out";

      if (lastAuthSessionKeyRef.current === nextSessionKey) {
        setAuthLoading(false);
        return;
      }

      lastAuthSessionKeyRef.current = nextSessionKey;
      setSession(nextSession);
      setCurrentUser(nextSession?.user ?? null);
      setAuthLoading(false);

      if (!nextSession?.user) {
        clearCoreCache(previousUserId);
        setCoreData(null);
        setSessions(null);
        setCoreError(null);
        setStatsError(null);
        setCoreLoading(false);
        coreDataRef.current = null;
        sessionsRef.current = null;
        processedNoticeId.current = null;
        return;
      }

      if (previousUserId && previousUserId !== nextSession.user.id) {
        clearCoreCache(previousUserId);
        setCoreData(null);
        setSessions(null);
        setCoreError(null);
        setStatsError(null);
        coreDataRef.current = null;
        sessionsRef.current = null;
        processedNoticeId.current = null;
      }

      const cachedCoreData = readCoreCache(nextSession.user.id);
      if (cachedCoreData) {
        setCoreData(cachedCoreData);
        coreDataRef.current = cachedCoreData;
        setRadarSubjectIds((current) =>
          current.length > 0
            ? current.filter((subjectId) => cachedCoreData.subjects.some((subject) => subject.id === subjectId && subject.is_active))
            : cachedCoreData.subjects.filter((subject) => subject.is_active).slice(0, 3).map((subject) => subject.id),
        );
      }

      void loadCoreData(nextSession.user).catch(() => {
        // The error is already stored in component state for the UI.
      });
    };

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) {
        return;
      }

      if (error) {
        setAuthError(error.message);
      }

      applySession(data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active || event === "INITIAL_SESSION") {
        return;
      }

      if (event === "SIGNED_OUT") {
        initializedUserIdsRef.current.clear();
      }

      applySession(nextSession);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [loadCoreData]);

  useEffect(() => {
    void syncTimer();
    const interval = window.setInterval(() => {
      void syncTimer();
    }, 1000);

    return () => window.clearInterval(interval);
  }, [syncTimer]);

  const persistSettings = useCallback(
    async (updates: Partial<UserSettings>) => {
      const user = currentUserRef.current;
      if (!user) {
        return;
      }

    const nextSettings = await updateUserSettings(user.id, updates);
      setCoreData((current) => (current ? { ...current, settings: nextSettings } : current));
      await syncChromeSettingsCache(nextSettings);

      if (updates.floating_mode_enabled !== undefined) {
        await setFloatingMode(Boolean(updates.floating_mode_enabled));
      }
    },
    [syncChromeSettingsCache],
  );

  const handleTabChange = useCallback(
    async (tab: AppTab) => {
      setActiveTab(tab);

      if (tab === "stats" && currentUserRef.current && sessionsRef.current === null) {
        void loadStatsData(currentUserRef.current);
      }

      await playSound("tab", settings);
    },
    [loadStatsData, settings],
  );

  const handleAuthSubmit = useCallback(
    async ({
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

          if (response.data.session) {
            lastAuthSessionKeyRef.current = null;
            currentUserRef.current = response.data.session.user;
            setSession(response.data.session);
            setCurrentUser(response.data.session.user);
            setAuthLoading(true);
            void loadCoreData(response.data.session.user, { force: true }).finally(() => {
              setAuthLoading(false);
            });
          }

          const showEasterEgg = Math.random() < 0.4;
          if (!response.data.session) {
            pushToast({
              tone: "success",
              title: "Account created",
              description:
                "Check your email to confirm your account if email confirmation is enabled. For extension-only testing, use a real Supabase Site URL or disable email confirmation.",
            });
          } else if (showEasterEgg) {
            pushToast({
              tone: "neutral",
              title: "Nice to see you again!",
            });
          }
        } else {
          const response = await signInWithEmail(email, password);
          if (response.error) {
            throw response.error;
          }

          if (response.data.session) {
            lastAuthSessionKeyRef.current = null;
            currentUserRef.current = response.data.session.user;
            setSession(response.data.session);
            setCurrentUser(response.data.session.user);
            setAuthLoading(true);
            void loadCoreData(response.data.session.user, { force: true }).finally(() => {
              setAuthLoading(false);
            });
          }
        }
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "Authentication failed.");
      } finally {
        setAuthBusy(false);
      }
    },
    [authMode, pushToast],
  );

  const handleGoogleAuth = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);

    try {
      const sessionData = await signInWithGoogle();
      const nextSession = sessionData && "session" in sessionData ? sessionData.session : null;

      if (nextSession) {
        lastAuthSessionKeyRef.current = null;
        currentUserRef.current = nextSession.user;
        setSession(nextSession);
        setCurrentUser(nextSession.user);
        setAuthLoading(true);
        void loadCoreData(nextSession.user, { force: true }).finally(() => {
          setAuthLoading(false);
        });
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Google sign-in failed.");
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const handleStart = useCallback(
    async ({
      subject,
      mode,
      durationMs,
    }: {
      subject: Subject;
      mode: "stopwatch" | "timer";
      durationMs: number | null;
    }) => {
      const user = currentUserRef.current;

      if (!session?.access_token || !session.refresh_token || !user) {
        throw new Error("Please log in again before starting a timer.");
      }

      await playSound("button", settings);
      const response = await startTimer({
        mode,
        subjectId: subject.id,
        subjectName: subject.name,
        subjectColor: subject.color,
        targetDurationMs: durationMs,
        userId: user.id,
        authAccessToken: session.access_token,
        authRefreshToken: session.refresh_token,
      });

      if (!response.ok || !response.data) {
        throw new Error(response.error ?? "Unable to start the timer.");
      }

      setTimerState(response.data);
    },
    [session, settings],
  );

  const handlePause = useCallback(async () => {
    await playSound("button", settings);
    const response = await pauseTimer();
    if (!response.ok || !response.data) {
      throw new Error(response.error ?? "Unable to pause the timer.");
    }
    setTimerState(response.data);
  }, [settings]);

  const handleResume = useCallback(async () => {
    await playSound("button", settings);
    const response = await resumeTimer();
    if (!response.ok || !response.data) {
      throw new Error(response.error ?? "Unable to resume the timer.");
    }
    setTimerState(response.data);
  }, [settings]);

  const handleStop = useCallback(async () => {
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
      !window.confirm(`This session is only ${durationSeconds} seconds long. Save it anyway? (Sessions under 30 seconds will ask before saving so accidental taps do not clutter your history)`)
    ) {
      pushToast({
        tone: "neutral",
        title: "Short session skipped",
        description: "You can start again whenever you're ready.",
      });
      return;
    }

    const savedSession = await saveStudySession(draft);
    setSessions((current) => (current ? [savedSession, ...current] : current));
    pushToast({
      tone: "success",
      title: "Session saved",
      description: `${savedSession.subject?.name ?? "Session"} logged for ${formatDurationShort(savedSession.duration_seconds)}.`,
    });
  }, [pushToast, settings]);

  const withTaskToast = useCallback(
    async (task: () => Promise<void>) => {
      try {
        await task();
      } catch (error) {
        pushToast({
          tone: "error",
          title: "Something needs attention",
          description: error instanceof Error ? error.message : "Please try again.",
        });
      }
    },
    [pushToast],
  );

  const handleSaveDisplayName = useCallback(
    async (displayName: string) => {
      const user = currentUserRef.current;
      if (!user || !displayName.trim()) {
        throw new Error("Please enter a display name first.");
      }

      const profile = await updateProfileDisplayName(user.id, displayName.trim());
      setCoreData((current) => (current ? { ...current, profile } : current));
      pushToast({ tone: "success", title: "Display name updated" });
    },
    [pushToast],
  );

  const handleAddSubject = useCallback(async ({ name, color }: { name: string; color: string }) => {
    const user = currentUserRef.current;
    if (!user) {
      return;
    }

    const subject = await addSubject(user.id, name, color);
    setCoreData((current) =>
      current
        ? {
            ...current,
            subjects: [...current.subjects, subject],
          }
        : current,
    );
  }, []);

  const handleUpdateSubject = useCallback(async (subjectId: string, payload: { name: string; color: string }) => {
    const subject = await renameSubject(subjectId, payload.name, payload.color);
    setCoreData((current) =>
      current
        ? {
            ...current,
            subjects: current.subjects.map((item) => (item.id === subjectId ? subject : item)),
          }
        : current,
    );
    setSessions((current) =>
      current
        ? current.map((session) =>
            session.subject_id === subjectId
              ? {
                  ...session,
                  subject: {
                    id: subject.id,
                    name: subject.name,
                    color: subject.color,
                    is_active: subject.is_active,
                  },
                }
              : session,
          )
        : current,
    );
  }, []);

  const handleArchiveSubject = useCallback(async (subjectId: string) => {
    const subject = await archiveSubject(subjectId);
    setCoreData((current) =>
      current
        ? {
            ...current,
            subjects: current.subjects.map((item) => (item.id === subjectId ? subject : item)),
          }
        : current,
    );
    setSessions((current) =>
      current
        ? current.map((session) =>
            session.subject_id === subjectId
              ? {
                  ...session,
                  subject: {
                    id: subject.id,
                    name: subject.name,
                    color: subject.color,
                    is_active: subject.is_active,
                  },
                }
              : session,
          )
        : current,
    );
    setRadarSubjectIds((current) => current.filter((id) => id !== subjectId));
  }, []);

  const handleLogout = useCallback(async () => {
    clearCoreCache(currentUserRef.current?.id);
    await supabase.auth.signOut();
    setCoreData(null);
    setSessions(null);
    setChallenges([]);
    setCoreError(null);
    setTimerState(null);
    setStatsError(null);
    processedNoticeId.current = null;
  }, []);

  const handleSaveChallenge = useCallback(
    async ({
      subjectId,
      dailyTargetMinutes,
      hpPenalty,
    }: {
      subjectId: string;
      dailyTargetMinutes: number;
      hpPenalty: number;
    }) => {
      const user = currentUserRef.current;
      if (!user) {
        return;
      }

      const next = await upsertChallenge(user.id, {
        subject_id: subjectId,
        daily_target_minutes: dailyTargetMinutes,
        hp_penalty: hpPenalty,
      });
      setChallenges(next);
      pushToast({
        tone: "success",
        title: "Challenge saved",
        description: "Daily target and HP loss updated.",
      });
    },
    [pushToast],
  );

  const handleDeleteChallenge = useCallback(
    async (challengeId: string) => {
      const user = currentUserRef.current;
      if (!user) {
        return;
      }

      const next = await deleteChallenge(user.id, challengeId);
      setChallenges(next);
      pushToast({
        tone: "neutral",
        title: "Challenge removed",
      });
    },
    [pushToast],
  );

  if (!isSupabaseConfigured) {
    return renderInPopupViewport(
      <div className="status-window-shell sw-shell p-6">
        <div className="flex h-full flex-col justify-center">
          <div className="sw-card mx-auto max-w-sm p-6 text-center">
            <Settings2 className="mx-auto h-10 w-10 text-[var(--sky-dark)]" />
            <h1 className="sw-panel-title mt-4">Supabase Setup Needed</h1>
            <p className="sw-copy mt-3">
              Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to a local
              <code> .env </code>
              file, then reload the extension build.
            </p>
          </div>
        </div>
      </div>,
    );
  }

  if (authLoading) {
    return renderInPopupViewport(
      <div className="status-window-shell sw-shell p-4">
        <div className="flex h-full flex-col gap-3">
          <section className="sw-card p-4">
            <div className="animate-pulse">
              <div className="sw-skeleton h-4 w-28" />
              <div className="sw-skeleton mt-3 h-7 w-44" />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="sw-skeleton h-20" />
                <div className="sw-skeleton h-20" />
              </div>
              <div className="sw-skeleton mt-3 h-12" />
              <div className="sw-skeleton mt-3 h-11" />
            </div>
          </section>
          <div className="flex items-center justify-center gap-2 text-sm text-[var(--ink-soft)]">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Syncing your workspace...
          </div>
        </div>
      </div>,
    );
  }

  if (!currentUser) {
    return renderInPopupViewport(
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
      </>,
    );
  }

  const displayName = coreData?.profile?.display_name || currentUser.email || "John Smith";
  const subjects = coreData?.subjects ?? [];
  const totalStudySeconds = sessions ? calculateTotalStudySeconds(sessions) : 0;
  const baseHp = sessions ? calculateHP(sessions) : 0;
  const challengePenalty = sessions ? calculateChallengePenalty(sessions, challenges).totalPenalty : 0;
  const hp = baseHp - challengePenalty;
  const level = calculateLevel(totalStudySeconds);
  const missingSchema = coreError?.includes("Missing database table") ?? false;

  return renderInPopupViewport(
    <>
      <ToastStack toasts={toasts} />
      <AppShell
        activeTab={activeTab}
        displayName={displayName}
        hp={hp}
        level={level}
        onTabChange={(tab) => {
          void withTaskToast(() => handleTabChange(tab));
        }}
      >
        {!coreData && !coreError ? (
          <LogTabSkeleton />
        ) : null}

        {!coreData && coreError ? (
          <PanelLoadingState
            label={missingSchema ? "Database setup missing" : "Dashboard failed to load"}
            description={coreError}
            hint={
              missingSchema ? (
                <>
                  <div>Auth is working, but this Supabase project is missing the app tables.</div>
                  <div className="mt-2">
                    Run the SQL blocks in [README.md](/Users/alicejiang/Documents/GitHub/Status-Window/README.md:41), especially the schema at lines 41-92 and the RLS/policies just below it.
                  </div>
                </>
              ) : undefined
            }
            retryLabel="Retry Dashboard"
            onRetry={() => {
              if (currentUserRef.current) {
                void withTaskToast(() => loadCoreData(currentUserRef.current!, { force: true }));
              }
            }}
          />
        ) : null}

        {coreData && activeTab === "log" ? (
          <LogTab
            subjects={subjects}
            activeTimer={timerState}
            onStart={(payload) => withTaskToast(() => handleStart(payload))}
            onPause={() => withTaskToast(handlePause)}
            onResume={() => withTaskToast(handleResume)}
            onStop={() => withTaskToast(handleStop)}
          />
        ) : null}

        {coreData && activeTab === "stats" && sessions === null && !statsError ? (
          <PanelLoadingState
            label="Loading your stats"
            description="Your Log tab is ready. Open stats once and we’ll pull in history and charts."
          />
        ) : null}

        {coreData && activeTab === "stats" && sessions === null && statsError ? (
          <PanelLoadingState
            label="Stats need another try"
            description={statsError}
            retryLabel="Retry Stats Sync"
            onRetry={() => {
              if (currentUserRef.current) {
                void withTaskToast(() => loadStatsData(currentUserRef.current!, { force: true }));
              }
            }}
          />
        ) : null}

        {coreData && activeTab === "stats" && sessions !== null ? (
          <Suspense
            fallback={
              <PanelLoadingState
                label="Opening your stats"
                description="Loading charts and history..."
              />
            }
          >
            <LazyStatsTab
              subjects={subjects}
              sessions={sessions}
              challenges={challenges}
              baseHp={baseHp}
              challengePenalty={challengePenalty}
              radarSubjectIds={radarSubjectIds}
              onChangeRadarIds={setRadarSubjectIds}
              onSaveChallenge={handleSaveChallenge}
              onDeleteChallenge={handleDeleteChallenge}
            />
          </Suspense>
        ) : null}

        {coreData && activeTab === "friends" ? (
          <FriendsTab
            userId={currentUser.id}
            userEmail={currentUser.email ?? null}
            onError={(msg) => pushToast({ tone: "error", title: "Friends", description: msg })}
          />
        ) : null}

        {coreData && activeTab === "info" ? <InfoTab /> : null}

        {coreData && activeTab === "settings" ? (
          <SettingsTab
            settings={settings}
            subjects={subjects}
            initialDisplayName={displayName}
            onUpdateSettings={(updates) =>
              withTaskToast(async () => {
                await persistSettings(updates);
              })
            }
            onAddSubject={(payload) => withTaskToast(() => handleAddSubject(payload))}
            onUpdateSubject={(subjectId, payload) => withTaskToast(() => handleUpdateSubject(subjectId, payload))}
            onArchiveSubject={(subjectId) => withTaskToast(() => handleArchiveSubject(subjectId))}
            onSaveDisplayName={(displayNameValue) => withTaskToast(() => handleSaveDisplayName(displayNameValue))}
            onLogout={() => withTaskToast(handleLogout)}
          />
        ) : null}
      </AppShell>
    </>,
  );
}
