import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EchoMessageOverlay } from "../components/Echo/EchoMessageOverlay";
import { EchoNamePrompt } from "../components/Echo/EchoNamePrompt";
import {
  completeInitialEcho,
  getInitialEchoLines,
  getNonNormalFollowupLines,
  isCorrectEchoName,
  level10PlaceholderLines,
  maybeTriggerEchoEasterEgg,
  maybeTriggerEchoFollowup,
  maybeTriggerLevel10Echo,
  namePromptRetryLines,
  namePromptSecondTimeoutLines,
  normalFollowupPromptLines,
  recordNamePromptDismissed,
  recordNamePromptShown,
  recordNamePromptSubmission,
  wrongNameLines,
} from "../lib/echoEasterEgg";
import type { EchoLine, EchoNamePromptResult, EchoOverlayResult } from "../types/echo";
import type { StudySession } from "../types";

type OverlayState =
  | { kind: "message"; key: string; lines: EchoLine[] }
  | { kind: "name_prompt"; key: string; attemptNumber: number };

interface UseEchoEasterEggOptions {
  userId: string | null;
  userLevel: number;
  timerActive: boolean;
  sessions: StudySession[] | null;
  sessionsLoaded: boolean;
}

function isSkippableResult(result: EchoOverlayResult | EchoNamePromptResult) {
  return typeof result === "object" ? result.type === "skipped" : result === "skipped";
}

export function useEchoEasterEgg({
  userId,
  userLevel,
  timerActive,
  sessions,
  sessionsLoaded,
}: UseEchoEasterEggOptions) {
  const [overlay, setOverlay] = useState<OverlayState | null>(null);
  const resolverRef = useRef<((value: EchoOverlayResult | EchoNamePromptResult) => void) | null>(null);
  const sequenceBusyRef = useRef(false);
  const lastProcessedSessionKeyRef = useRef<string | null>(null);
  const previousLevelRef = useRef<number>(userLevel);
  const previousLevelUserIdRef = useRef<string | null>(null);
  const hasHydratedLevelRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      resolverRef.current = null;
      sequenceBusyRef.current = false;
      lastProcessedSessionKeyRef.current = null;
      previousLevelRef.current = 0;
      previousLevelUserIdRef.current = null;
      hasHydratedLevelRef.current = false;
      setOverlay(null);
      return;
    }

    if (previousLevelUserIdRef.current !== userId) {
      previousLevelUserIdRef.current = userId;
      previousLevelRef.current = userLevel;
      lastProcessedSessionKeyRef.current = null;
      hasHydratedLevelRef.current = false;
      setOverlay(null);
      sequenceBusyRef.current = false;
      resolverRef.current = null;
    }
  }, [userId, userLevel]);

  const resolveOverlay = useCallback((result: EchoOverlayResult | EchoNamePromptResult) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setOverlay(null);
    resolve?.(result);
  }, []);

  const showMessage = useCallback((lines: EchoLine[]) => {
    return new Promise<EchoOverlayResult>((resolve) => {
      resolverRef.current = (value) => resolve(value as EchoOverlayResult);
      setOverlay({
        kind: "message",
        key: crypto.randomUUID(),
        lines,
      });
    });
  }, []);

  const showNamePrompt = useCallback((attemptNumber: number) => {
    return new Promise<EchoNamePromptResult>((resolve) => {
      resolverRef.current = (value) => resolve(value as EchoNamePromptResult);
      setOverlay({
        kind: "name_prompt",
        key: crypto.randomUUID(),
        attemptNumber,
      });
    });
  }, []);

  const runExclusiveSequence = useCallback(async (task: () => Promise<void>) => {
    if (sequenceBusyRef.current) {
      return false;
    }

    sequenceBusyRef.current = true;
    try {
      await task();
      return true;
    } catch (error) {
      console.error("Status Window echo easter egg failed:", error);
      return false;
    } finally {
      resolverRef.current = null;
      setOverlay(null);
      sequenceBusyRef.current = false;
    }
  }, []);

  const runNamePromptSequence = useCallback(
    async (nextUserId: string) => {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        await recordNamePromptShown(nextUserId, attempt);
        const promptResult = await showNamePrompt(attempt);

        if (isSkippableResult(promptResult)) {
          await recordNamePromptDismissed(nextUserId, 2);
          return;
        }

        if (promptResult.type === "submit") {
          const submittedName = promptResult.value?.trim() ?? "";
          const correct = isCorrectEchoName(submittedName);
          await recordNamePromptSubmission(nextUserId, submittedName, correct);

          if (!correct) {
            await showMessage(wrongNameLines);
          } else {
            await showMessage([
              {
                text: "// TODO: future correct-name echo logic goes here",
                pauseAfterMs: 900,
              },
            ]);
          }
          return;
        }

        if (attempt === 1) {
          const retryResult = await showMessage(namePromptRetryLines);
          if (isSkippableResult(retryResult)) {
            await recordNamePromptDismissed(nextUserId, 2);
            return;
          }
          continue;
        }

        await recordNamePromptDismissed(nextUserId, attempt);
        await showMessage(namePromptSecondTimeoutLines);
        return;
      }
    },
    [showMessage, showNamePrompt],
  );

  const maybeTriggerInitialEcho = useCallback(async () => {
    if (!userId || timerActive || sequenceBusyRef.current) {
      return false;
    }

    try {
      const triggerResult = await maybeTriggerEchoEasterEgg(userId, userLevel, timerActive);
      if (!triggerResult) {
        return false;
      }

      void runExclusiveSequence(async () => {
        await showMessage(getInitialEchoLines(triggerResult.branch));
        await completeInitialEcho(userId);
      });

      return true;
    } catch (error) {
      console.error("Status Window initial echo trigger failed:", error);
      return false;
    }
  }, [runExclusiveSequence, showMessage, timerActive, userId, userLevel]);

  const maybeTriggerFollowupForSession = useCallback(
    async (session: StudySession) => {
      if (!userId || timerActive || sequenceBusyRef.current) {
        return false;
      }

      try {
        const triggerResult = await maybeTriggerEchoFollowup(userId, session);
        if (!triggerResult) {
          return false;
        }

        void runExclusiveSequence(async () => {
          if (triggerResult.initialBranch === "normal_restore") {
            const promptPreludeResult = await showMessage(normalFollowupPromptLines);
            if (!isSkippableResult(promptPreludeResult)) {
              await runNamePromptSequence(userId);
            }
            return;
          }

          if (triggerResult.followupBranch) {
            await showMessage(getNonNormalFollowupLines(triggerResult.followupBranch));
          }
        });

        return true;
      } catch (error) {
        console.error("Status Window echo follow-up trigger failed:", error);
        return false;
      }
    },
    [runExclusiveSequence, runNamePromptSequence, showMessage, timerActive, userId],
  );

  const maybeTriggerPendingLevel10Echo = useCallback(
    async (oldLevel: number, newLevel: number) => {
      if (!userId || timerActive || sequenceBusyRef.current) {
        return false;
      }

      try {
        const triggerResult = await maybeTriggerLevel10Echo(userId, oldLevel, newLevel);
        if (!triggerResult) {
          return false;
        }

        void runExclusiveSequence(async () => {
          await showMessage(level10PlaceholderLines);
        });

        return true;
      } catch (error) {
        console.error("Status Window level 10 echo trigger failed:", error);
        return false;
      }
    },
    [runExclusiveSequence, showMessage, timerActive, userId],
  );

  useEffect(() => {
    if (!userId || !sessions || sessions.length === 0 || timerActive || sequenceBusyRef.current) {
      return;
    }

    const latestSession = sessions[0];
    const latestSessionKey = `${userId}:${latestSession.id}:${latestSession.end_time}`;
    if (lastProcessedSessionKeyRef.current === latestSessionKey) {
      return;
    }

    lastProcessedSessionKeyRef.current = latestSessionKey;
    void maybeTriggerFollowupForSession(latestSession);
  }, [maybeTriggerFollowupForSession, sessions, timerActive, userId]);

  useEffect(() => {
    if (!userId || !sessionsLoaded) {
      return;
    }

    if (!hasHydratedLevelRef.current) {
      previousLevelRef.current = userLevel;
      hasHydratedLevelRef.current = true;
      return;
    }

    const oldLevel = previousLevelRef.current;
    previousLevelRef.current = userLevel;

    if (oldLevel === userLevel) {
      return;
    }

    void maybeTriggerPendingLevel10Echo(oldLevel, userLevel);
  }, [maybeTriggerPendingLevel10Echo, sessionsLoaded, userId, userLevel]);

  const overlayElement = useMemo(() => {
    if (!overlay) {
      return null;
    }

    if (overlay.kind === "message") {
      return (
        <EchoMessageOverlay
          key={overlay.key}
          lines={overlay.lines}
          onResolve={resolveOverlay}
        />
      );
    }

    return (
      <EchoNamePrompt
        key={overlay.key}
        attemptNumber={overlay.attemptNumber}
        onResolve={resolveOverlay}
      />
    );
  }, [overlay, resolveOverlay]);

  return {
    overlay: overlayElement,
    maybeTriggerEchoEasterEgg: maybeTriggerInitialEcho,
  };
}
