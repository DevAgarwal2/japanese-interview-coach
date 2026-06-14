"use client";
import { useEffect, useRef } from "react";
import { cn } from "~/lib/utils";

export interface Turn {
  id: string;
  role: "interviewer" | "candidate";
  text: string;
  /** If true, the text is still streaming in. */
  streaming?: boolean;
  /** Optional id of the question this turn is answering. */
  questionId?: string;
}

interface Props {
  turns: Turn[];
}

export default function TranscriptThread({ turns }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    const last = scrollRef.current.lastElementChild;
    if (!last) return;
    last.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length]);

  // After a new interviewer turn lands, scroll the page so the new question
  // sits in the upper half of the viewport (above the orb) instead of
  // getting hidden below the footer.
  useEffect(() => {
    const lastInterviewer = [...turns].reverse().find((t) => t.role === "interviewer");
    if (!lastInterviewer) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`turn-${lastInterviewer.id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    return () => clearTimeout(t);
  }, [turns]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-1 sm:px-2 py-2"
      style={{
        scrollbarGutter: "stable",
      }}
    >
      <div className="max-w-[60ch] mx-auto flex flex-col gap-7 sm:gap-9">
        {turns.map((t) => (
          <TurnBlock key={t.id} turn={t} />
        ))}

        {turns.length === 0 && (
          <div
            className="text-center py-16 text-body-sm"
            style={{ color: "var(--color-text-muted)" }}
          >
            Press the orb when you are ready to begin.
          </div>
        )}
      </div>
    </div>
  );
}

function TurnBlock({ turn }: { turn: Turn }) {
  const isInterviewer = turn.role === "interviewer";

  return (
    <div
      id={`turn-${turn.id}`}
      className={cn(
        "animate-fade-in-up",
        isInterviewer ? "" : "pl-6 sm:pl-10",
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-eyebrow"
          style={{
            color: isInterviewer ? "var(--color-ink)" : "var(--color-vermillion)",
          }}
        >
          {isInterviewer ? "Interviewer" : "You"}
        </span>
        {turn.streaming && (
          <span
            className="inline-block w-1.5 h-1.5 rounded-full animate-pulse-dot"
            style={{ background: "var(--color-vermillion)" }}
          />
        )}
      </div>

      <p
        className={cn(
          isInterviewer ? "text-jp" : "text-body text-jp",
        )}
        style={{
          fontFamily: isInterviewer ? "var(--font-jp)" : "var(--font-jp)",
          color: isInterviewer ? "var(--color-ink)" : "var(--color-text)",
          fontSize: isInterviewer ? "1.0625rem" : "1rem",
          lineHeight: 1.85,
        }}
      >
        {turn.text}
        {turn.streaming && (
          <span
            className="inline-block w-[2px] h-[1em] align-middle ml-0.5"
            style={{
              background: "var(--color-ink)",
              animation: "pulseDot 0.8s steps(2) infinite",
            }}
          />
        )}
      </p>
    </div>
  );
}
