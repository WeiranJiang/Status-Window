import { useEffect, useMemo, useState } from "react";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import type { EchoLine, EchoLineShake, EchoOverlayResult } from "../../types/echo";

const speedRanges = {
  normal: [35, 55],
  fast: [18, 30],
  glitch: [8, 15],
} as const;

const shakeClassNames: Record<EchoLineShake, string> = {
  none: "",
  light: "echo-shake-light",
  medium: "echo-shake-medium",
  violent: "echo-shake-violent",
};

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

interface EchoMessageOverlayProps {
  lines: EchoLine[];
  onResolve: (result: EchoOverlayResult) => void;
  skipLabel?: string;
}

export function EchoMessageOverlay({
  lines,
  onResolve,
  skipLabel = "Skip",
}: EchoMessageOverlayProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [typingIndex, setTypingIndex] = useState<number | null>(0);

  const normalizedLines = useMemo(
    () =>
      lines.map((line) => ({
        speed: "normal" as const,
        shake: "none" as const,
        flicker: false,
        pauseAfterMs: 900,
        ...line,
      })),
    [lines],
  );

  useEffect(() => {
    let active = true;

    const run = async () => {
      const renderedLines: string[] = [];
      setVisibleLines([]);
      setTypingIndex(0);

      for (let lineIndex = 0; lineIndex < normalizedLines.length; lineIndex += 1) {
        if (!active) {
          return;
        }

        const line = normalizedLines[lineIndex];
        if (prefersReducedMotion) {
          renderedLines.push(line.text);
          setVisibleLines([...renderedLines]);
          setTypingIndex(lineIndex);
          await sleep(Math.min(line.pauseAfterMs ?? 0, 180));
          continue;
        }

        let nextText = "";
        for (const character of line.text) {
          if (!active) {
            return;
          }

          nextText += character;
          const nextLines = [...renderedLines, nextText];
          setVisibleLines(nextLines);
          setTypingIndex(lineIndex);

          const [minDelay, maxDelay] = speedRanges[line.speed ?? "normal"];
          await sleep(randomBetween(minDelay, maxDelay));
        }

        renderedLines.push(nextText);
        setVisibleLines([...renderedLines]);
        await sleep(line.pauseAfterMs ?? 0);
      }

      if (!active) {
        return;
      }

      setTypingIndex(null);
      onResolve("completed");
    };

    void run();

    return () => {
      active = false;
    };
  }, [normalizedLines, onResolve, prefersReducedMotion]);

  return (
    <div className="echo-overlay-backdrop">
      <div className="echo-overlay-panel">
        <div className="flex items-start justify-between gap-4">
          <div className="echo-overlay-label">Echo</div>
          <button
            type="button"
            onClick={() => onResolve("skipped")}
            className="echo-overlay-skip"
          >
            {skipLabel}
          </button>
        </div>
        <div className="mt-5 flex min-h-[220px] flex-col gap-2">
          {visibleLines.map((text, index) => {
            const line = normalizedLines[index];
            const isTyping = typingIndex === index;
            return (
              <p
                key={`${index}-${text.length}`}
                className={[
                  "echo-line",
                  !prefersReducedMotion ? shakeClassNames[line.shake ?? "none"] : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className={!prefersReducedMotion && line.flicker ? "echo-flicker" : ""}>{text}</span>
                {isTyping ? <span className="echo-caret" aria-hidden="true" /> : null}
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
}
