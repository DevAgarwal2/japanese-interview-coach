"use client";
import { formatMs } from "~/lib/utils";

interface Props {
  elapsedMs: number;
  /** Optional cap; when set, the timer turns vermillion past 80% of the cap. */
  capMs?: number;
  questionNumber: number;
  totalQuestions: number;
}

export default function SessionTimer({ elapsedMs, capMs, questionNumber, totalQuestions }: Props) {
  const overSoft = capMs ? elapsedMs / capMs > 0.8 : false;
  const overHard = capMs ? elapsedMs > capMs : false;

  return (
    <div
      className="w-full flex items-center justify-between py-3 px-1 text-mono"
      style={{ color: "var(--color-text-faint)" }}
    >
      <div className="flex items-center gap-3">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full animate-pulse-dot"
          style={{
            background: overHard
              ? "var(--color-vermillion-deep)"
              : overSoft
              ? "var(--color-vermillion)"
              : "var(--color-ink)",
          }}
        />
        <span style={{ color: "var(--color-text-secondary)" }}>{formatMs(elapsedMs)}</span>
        {capMs && (
          <span style={{ color: "var(--color-text-muted)" }}>
            / {formatMs(capMs)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span style={{ color: "var(--color-text-muted)" }}>Question</span>
        <span
          className="font-display"
          style={{
            color: "var(--color-ink)",
            fontSize: "0.95rem",
            letterSpacing: "0.01em",
          }}
        >
          {String(questionNumber).padStart(2, "0")}
        </span>
        <span style={{ color: "var(--color-text-muted)" }}>
          / {String(totalQuestions).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}
