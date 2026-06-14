"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, RotateCcw, Volume2 } from "lucide-react";
import {
  CATEGORIES,
  DIFFICULTY,
  LENGTHS,
  TONE,
  type Category,
  type Difficulty,
  type VoiceTone,
  type LengthKey,
} from "~/lib/categories";
import {
  transcribe,
  tts,
  generateReport,
  checkReady,
} from "~/lib/api";
import { blobToWavBase64 } from "~/lib/audio";
import { useVoiceMode } from "~/lib/useVoiceMode";
import VoiceOrb, { type OrbState } from "~/components/VoiceOrb";
import SessionTimer from "~/components/session/SessionTimer";
import TranscriptThread, { type Turn } from "~/components/session/TranscriptThread";
import CategoryCard from "~/components/setup/CategoryCard";
import { cn, formatMs } from "~/lib/utils";

type Phase = "setup" | "ready" | "speaking" | "listening" | "processing" | "ended";

interface SessionConfig {
  category: Category;
  difficulty: Difficulty;
  tone: VoiceTone;
  length: LengthKey;
}

interface QAPair {
  question: string;
  answer: string;
}

export default function Interview() {
  const [categoryId, setCategoryId] = useState<string>(CATEGORIES[0].id);
  const [difficulty, setDifficulty] = useState<Difficulty>("mid");
  const [tone, setTone] = useState<VoiceTone>("warm");
  const [length, setLength] = useState<LengthKey>("medium");

  const [phase, setPhase] = useState<Phase>("setup");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [records, setRecords] = useState<QAPair[]>([]);
  const [finalReport, setFinalReport] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [now, setNow] = useState<number>(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef(false);

  const voice = useVoiceMode({
    onRecording: (blob) => {
      console.log("[voice] recording ready, size:", blob.size);
      handleAnswer(blob);
    },
    onAmplitude: () => {},
  });

  const category = useMemo(
    () => CATEGORIES.find((c) => c.id === categoryId) ?? CATEGORIES[0],
    [categoryId],
  );
  const config: SessionConfig = { category, difficulty, tone, length };
  const capMs = LENGTHS[length].seconds * 1000;
  const totalQuestions = LENGTHS[length].questions;

  const questionQueue = useRef<string[]>([]);
  // Ref so callbacks read the latest value without a stale closure.
  const nextQuestionRef = useRef(0);

  useEffect(() => {
    if (phase === "setup" || phase === "ended") return;
    const i = window.setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(i);
  }, [phase]);

  useEffect(() => {
    if (startedAt > 0) setElapsedMs(now - startedAt);
  }, [now, startedAt]);

  useEffect(() => {
    checkReady().then(setApiOk);
  }, []);

  const playAudio = useCallback((b64: string | null) => {
    if (!b64) return;
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      audioRef.current = a;
      a.onended = () => URL.revokeObjectURL(url);
      a.play().catch(() => {});
    } catch {}
  }, []);

  const askNextQuestion = useCallback(
    async (queue: string[], qIndex: number) => {
      if (qIndex >= queue.length) return;
      const question = queue[qIndex];

      const id = `q-${qIndex}`;
      setTurns((prev) => [
        ...prev,
        { id, role: "interviewer", text: question },
      ]);

      setPhase("speaking");
      try {
        const ttsB64 = await tts(question);
        playAudio(ttsB64);
        const durationMs = estimateWavB64Ms(ttsB64);
        window.setTimeout(() => {
          if (!abortRef.current) {
            setPhase("listening");
            voice.start();
          }
        }, Math.min(durationMs, 14_000));
      } catch (e: any) {
        setError(`TTS unavailable: ${e?.message || ""}`);
        setPhase("listening");
        voice.start();
      }
    },
    [playAudio, voice],
  );

  // Declared before handleAnswer so it can be referenced from there.
  const wrapUp = useCallback(async () => {
    setPhase("processing");

    const transcriptText = records
      .map(
        (r, i) =>
          `Q${i + 1}: ${r.question}\nA: ${r.answer}`,
      )
      .join("\n\n");

    let report = "(レポートを生成できませんでした)";
    try {
      report = await generateReport({
        questionCount: records.length,
        transcript: transcriptText,
      });
    } catch (e: any) {
      // First attempt failed (often the model echoes the transcript). Retry
      // once with a stricter prompt before giving up.
      try {
        report = await generateReport({
          questionCount: records.length,
          transcript: transcriptText,
          strict: true,
        });
      } catch (e2: any) {
        setError(e2?.message || "Could not generate report.");
      }
    }

    setFinalReport(report);
    setTurns((prev) => [
      ...prev,
      { id: "report", role: "interviewer", text: report },
    ]);

    try {
      const ttsB64 = await tts(report);
      playAudio(ttsB64);
    } catch {}

    setPhase("ended");
  }, [records, config, startedAt, playAudio]);

  const handleAnswer = useCallback(
    async (blob: Blob) => {
      setError(null);
      setPhase("processing");
      abortRef.current = false;

      let wavB64 = "";
      try {
        wavB64 = await blobToWavBase64(blob);
      } catch (e: any) {
        setError("Could not encode your audio. Please try again.");
        setPhase("ready");
        return;
      }

      let transcript = "";
      try {
        transcript = await transcribe(wavB64);
      } catch (e: any) {
        setError(e?.message || "Could not transcribe your answer.");
        setPhase("ready");
        return;
      }
      if (!transcript) {
        setError("No speech detected. Please try again.");
        setPhase("ready");
        return;
      }

      // Read the question from the ref (not state) to avoid stale closures.
      const lastAsked = nextQuestionRef.current - 1;
      const currentQuestion = questionQueue.current[lastAsked] || "";
      console.log("[handleAnswer] lastAsked=", lastAsked, "queueLen=", questionQueue.current.length, "currentQ=", JSON.stringify(currentQuestion.slice(0, 60)));
      setTurns((prev) => [
        ...prev,
        { id: `c-${Date.now()}`, role: "candidate", text: transcript },
      ]);

      setRecords((prev) => [
        ...prev,
        { question: currentQuestion, answer: transcript },
      ]);

      // Ref-tracked index avoids the stale `questionIndex` state.
      const nextIndex = nextQuestionRef.current;
      console.log("[handleAnswer] nextIndex=", nextIndex, "queueLen=", questionQueue.current.length);
      if (nextIndex >= questionQueue.current.length) {
        await wrapUp();
        return;
      }
      setQuestionIndex(nextIndex + 1);
      nextQuestionRef.current = nextIndex + 1;
      console.log("[handleAnswer] calling askNextQuestion with qIndex=", nextIndex);
      await askNextQuestion(questionQueue.current, nextIndex);
    },
    [askNextQuestion, wrapUp],
  );

  const startSession = useCallback(async () => {
    setError(null);
    setTurns([]);
    setRecords([]);
    setFinalReport("");
    setQuestionIndex(0);
    nextQuestionRef.current = 0;
    setStartedAt(Date.now());
    setElapsedMs(0);

    const openerQs = [...category.openers];
    const probeQs = category.probe.map(
      (p) => `${p}について、具体的な経験を教えてください。`,
    );
    for (let i = openerQs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [openerQs[i], openerQs[j]] = [openerQs[j], openerQs[i]];
    }
    for (let i = probeQs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [probeQs[i], probeQs[j]] = [probeQs[j], probeQs[i]];
    }
    const queue = [...openerQs, ...probeQs].slice(0, totalQuestions);
    questionQueue.current = queue;
    // 0 is the question we just asked; the next one is at index 1.
    nextQuestionRef.current = 1;
    console.log("[startSession] queue set, length=", queue.length, "first=", JSON.stringify(queue[0]?.slice(0, 60)));

    setQuestionIndex(1);
    await askNextQuestion(queue, 0);
  }, [category, totalQuestions, askNextQuestion]);

  const handleMicPress = useCallback(() => {
    if (phase === "ready") {
      voice.start();
      setPhase("listening");
    } else if (phase === "listening") {
      voice.stop();
    } else if (phase === "speaking" || phase === "processing") {
      abortRef.current = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      setPhase("ready");
    }
  }, [phase, voice]);

  const orbState: OrbState =
    phase === "listening"
      ? "listening"
      : phase === "speaking"
      ? "speaking"
      : phase === "processing"
      ? "thinking"
      : "idle";

  if (phase === "setup") {
    return (
      <SetupScreen
        categoryId={categoryId}
        setCategoryId={setCategoryId}
        difficulty={difficulty}
        setDifficulty={setDifficulty}
        tone={tone}
        setTone={setTone}
        length={length}
        setLength={setLength}
        onStart={startSession}
        apiOk={apiOk}
      />
    );
  }

  return (
    <SessionScreen
      category={category}
      difficulty={difficulty}
      tone={tone}
      length={length}
      totalQuestions={totalQuestions}
      questionIndex={Math.min(questionIndex, totalQuestions)}
      elapsedMs={elapsedMs}
      capMs={capMs}
      phase={phase}
      turns={turns}
      orbState={orbState}
      amplitude={voice.amplitude}
      durationMs={voice.durationMs}
      listening={voice.recording}
      onMicPress={handleMicPress}
      onEnd={() => {
        abortRef.current = true;
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
        }
        voice.stop();
        // Generate a report from whatever answers we already have.
        wrapUp();
      }}
      onRestart={() => {
        setPhase("setup");
        setTurns([]);
        setRecords([]);
        setFinalReport("");
        setQuestionIndex(0);
        nextQuestionRef.current = 0;
        setStartedAt(0);
        setElapsedMs(0);
      }}
      onHome={() => {
        abortRef.current = true;
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
        }
        voice.stop();
        setPhase("setup");
        setTurns([]);
        setRecords([]);
        setFinalReport("");
        setQuestionIndex(0);
        nextQuestionRef.current = 0;
        setStartedAt(0);
        setElapsedMs(0);
      }}
      onReplayLast={() => {
        const last = [...turns].reverse().find((t) => t.role === "interviewer");
        if (last) tts(last.text).then((w) => playAudio(w)).catch(() => {});
      }}
      error={error}
    />
  );
}

// ====================== Setup screen ======================

interface SetupProps {
  categoryId: string;
  setCategoryId: (id: string) => void;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  tone: VoiceTone;
  setTone: (t: VoiceTone) => void;
  length: LengthKey;
  setLength: (l: LengthKey) => void;
  onStart: () => void;
  apiOk: boolean | null;
}

function SetupScreen(p: SetupProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 sm:px-10 pt-8 sm:pt-12 pb-6 flex items-center justify-between animate-fade-in">
        <div className="flex items-center gap-3">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: "var(--color-vermillion)" }}
          />
          <span className="text-mono" style={{ color: "var(--color-text-faint)" }}>
            interview coach
          </span>
        </div>
        <div className="flex items-center gap-4">
          <ConnectionPill ok={p.apiOk} />
        </div>
      </header>

      <main className="flex-1 px-6 sm:px-10 pb-32">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10 sm:mb-14 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center animate-fade-in-up">
            <div>
              <p className="text-eyebrow mb-3" style={{ color: "var(--color-vermillion)" }}>
                面接練習 · Interview practice
              </p>
              <h1 className="text-display mb-5" style={{ maxWidth: "16ch" }}>
                声に出して、<br />
                <span style={{ color: "var(--color-vermillion)" }}>繰り返し練習。</span>
              </h1>
              <p className="text-lead">
                日本語の面接を、音声で。答えればその場でスコア。声に出すことで、言葉が整理されていく。
              </p>
            </div>
            <div className="order-first md:order-last">
              <img
                src="/hero.jpg"
                alt="面接の練習"
                className="w-full h-auto rounded-lg"
                style={{
                  boxShadow: "0 1px 2px oklch(0% 0 0 / 0.04)",
                  border: "1px solid var(--color-rule-faint)",
                }}
                loading="eager"
              />
            </div>
          </div>

          <section className="mb-10 animate-fade-in-up delay-2">
            <div className="flex items-end justify-between mb-4">
              <div>
                <p className="text-eyebrow mb-1">01 — Role</p>
                <h2 className="text-title" style={{ fontSize: "1.625rem" }}>
                  What are you interviewing for?
                </h2>
              </div>
            </div>
            <div
              className="grid gap-3 sm:gap-4"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
            >
              {CATEGORIES.map((c, i) => (
                <CategoryCard
                  key={c.id}
                  category={c}
                  selected={p.categoryId === c.id}
                  onClick={() => p.setCategoryId(c.id)}
                  index={i}
                />
              ))}
            </div>
          </section>

          <section
            className="mb-10 grid gap-8 sm:gap-12 animate-fade-in-up delay-3"
            style={{ gridTemplateColumns: "1fr", maxWidth: "900px" }}
          >
            <div>
              <p className="text-eyebrow mb-3">02 — Calibrate</p>
              <h2 className="text-title mb-3" style={{ fontSize: "1.375rem" }}>
                How senior are you, on the role?
              </h2>
              <Segmented
                value={p.difficulty}
                onChange={(v) => p.setDifficulty(v as Difficulty)}
                options={[
                  { value: "junior", label: DIFFICULTY.junior.label, sub: DIFFICULTY.junior.jp },
                  { value: "mid", label: DIFFICULTY.mid.label, sub: DIFFICULTY.mid.jp },
                  { value: "senior", label: DIFFICULTY.senior.label, sub: DIFFICULTY.senior.jp },
                ]}
              />
            </div>

            <div>
              <p className="text-eyebrow mb-3">03 — Voice</p>
              <h2 className="text-title mb-3" style={{ fontSize: "1.375rem" }}>
                How should the interviewer sound?
              </h2>
              <Segmented
                value={p.tone}
                onChange={(v) => p.setTone(v as VoiceTone)}
                options={[
                  { value: "warm", label: TONE.warm.label, sub: TONE.warm.jp },
                  { value: "exact", label: TONE.exact.label, sub: TONE.exact.jp },
                  { value: "direct", label: TONE.direct.label, sub: TONE.direct.jp },
                ]}
              />
            </div>

            <div>
              <p className="text-eyebrow mb-3">04 — Length</p>
              <h2 className="text-title mb-3" style={{ fontSize: "1.375rem" }}>
                How long?
              </h2>
              <Segmented
                value={p.length}
                onChange={(v) => p.setLength(v as LengthKey)}
                options={[
                  { value: "short", label: LENGTHS.short.label, sub: `${LENGTHS.short.questions}問` },
                  { value: "medium", label: LENGTHS.medium.label, sub: `${LENGTHS.medium.questions}問` },
                  { value: "long", label: LENGTHS.long.label, sub: `${LENGTHS.long.questions}問` },
                ]}
              />
            </div>
          </section>

          <div className="animate-fade-in-up delay-5">
            <button
              className="btn-ink"
              onClick={p.onStart}
              disabled={!p.apiOk}
              style={{ padding: "0.875rem 1.75rem", fontSize: "0.9375rem" }}
            >
              Start the interview
              <ArrowRight size={16} />
            </button>
            {!p.apiOk && (
              <p
                className="text-body-sm mt-3"
                style={{ color: "var(--color-text-muted)" }}
              >
                Connect the audio server in Settings before starting.
              </p>
            )}
          </div>
        </div>
      </main>

      <footer
        className="px-6 sm:px-10 py-6 text-mono"
        style={{ color: "var(--color-text-muted)" }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span>Powered by LFM2.5-Audio-1.5B</span>
          <span>音声のみで完結します</span>
        </div>
      </footer>
    </div>
  );
}

function ConnectionPill({ ok }: { ok: boolean | null }) {
  const label = ok === null ? "checking…" : ok ? "connected" : "offline";
  const color =
    ok === null
      ? "var(--color-text-muted)"
      : ok
      ? "var(--color-moss)"
      : "var(--color-vermillion)";
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-eyebrow"
      style={{
        border: "1px solid var(--color-rule)",
        color: "var(--color-text-secondary)",
      }}
    >
      <span
        className={cn("inline-block w-1.5 h-1.5 rounded-full", ok !== null && "animate-pulse-dot")}
        style={{ background: color }}
      />
      {label}
    </div>
  );
}

interface SegmentedOption {
  value: string;
  label: string;
  sub: string;
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SegmentedOption[];
}) {
  return (
    <div
      className="inline-flex p-1 rounded-lg"
      style={{
        background: "var(--color-cream-warm)",
        border: "1px solid var(--color-rule-faint)",
      }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="flex flex-col items-start px-4 py-2.5 rounded-md transition-all"
            style={{
              background: selected ? "var(--color-paper)" : "transparent",
              boxShadow: selected
                ? "0 1px 2px oklch(0% 0 0 / 0.05), 0 0 0 1px var(--color-ink-muted)"
                : "none",
              minWidth: "100px",
            }}
          >
            <span
              className="text-body-sm"
              style={{
                fontWeight: selected ? 600 : 500,
                color: selected ? "var(--color-ink)" : "var(--color-text-secondary)",
              }}
            >
              {o.label}
            </span>
            <span
              className="text-jp text-xs"
              style={{ color: "var(--color-text-faint)" }}
            >
              {o.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ====================== Session screen ======================

interface SessionProps {
  category: Category;
  difficulty: Difficulty;
  tone: VoiceTone;
  length: LengthKey;
  totalQuestions: number;
  questionIndex: number;
  elapsedMs: number;
  capMs: number;
  phase: Phase;
  turns: Turn[];
  orbState: OrbState;
  amplitude: number;
  durationMs: number;
  listening: boolean;
  onMicPress: () => void;
  onEnd: () => void;
  onRestart: () => void;
  onHome: () => void;
  onReplayLast: () => void;
  error: string | null;
}

function SessionScreen(p: SessionProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 sm:px-10 pt-5 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="font-display text-lg flex-shrink-0"
            style={{ color: "var(--color-ink)" }}
          >
            {p.category.name}
          </span>
          <span
            className="hidden sm:inline-block w-px h-3"
            style={{ background: "var(--color-rule)" }}
          />
          <span
            className="hidden sm:inline-block text-jp text-body-sm truncate"
            style={{ color: "var(--color-text-faint)" }}
          >
            {p.category.jp}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="btn-link"
            onClick={p.onReplayLast}
            title="Replay the last question"
          >
            <Volume2 size={14} /> Replay
          </button>
          <button className="btn-link" onClick={p.onEnd}>
            End
          </button>
        </div>
      </header>

      <div className="px-6 sm:px-10 max-w-3xl mx-auto w-full">
        <SessionTimer
          elapsedMs={p.elapsedMs}
          capMs={p.capMs}
          questionNumber={p.questionIndex}
          totalQuestions={p.totalQuestions}
        />
        <div className="rule-faint" />
      </div>

      <main className="flex-1 px-4 sm:px-6 py-4 overflow-hidden flex flex-col max-w-3xl mx-auto w-full">
        <TranscriptThread turns={p.turns} />
      </main>

      <footer
        className="px-6 sm:px-10 pt-2 pb-8 sm:pb-10"
        style={{ borderTop: "1px solid var(--color-rule-faint)" }}
      >
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-3">
          <p
            className="text-eyebrow"
            style={{ color: phaseColor(p.phase) }}
          >
            {phaseLabel(p.phase, p.listening, p.durationMs)}
          </p>

          <button
            onClick={p.onMicPress}
            className="relative flex items-center justify-center outline-none cursor-pointer bg-transparent border-0 p-0"
            aria-label={
              p.phase === "listening" ? "Stop recording" :
              p.phase === "ready" ? "Start answering" :
              "Cancel"
            }
          >
            <VoiceOrb state={p.orbState} amplitude={p.amplitude} size={180} />
          </button>

          {p.error && (
            <p
              className="text-body-sm text-center"
              style={{ color: "var(--color-vermillion)" }}
            >
              {p.error}
            </p>
          )}

          {p.phase === "ended" && (
            <div className="flex flex-col items-center gap-3 mt-4 w-full max-w-md">
              <button
                className="btn-ink w-full"
                onClick={p.onRestart}
                style={{ padding: "0.875rem 1.25rem" }}
              >
                <RotateCcw size={16} /> 新しい面接を受ける
              </button>
              <button
                className="btn-ghost w-full"
                onClick={p.onHome}
                style={{ padding: "0.75rem 1.25rem" }}
              >
                ホームに戻る
              </button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

function phaseLabel(phase: Phase, listening: boolean, durationMs: number): string {
  switch (phase) {
    case "ready":
      return "Press to answer";
    case "listening":
      return listening ? `Listening · ${formatMs(durationMs)}` : "Listening…";
    case "speaking":
      return "Interviewer is speaking";
    case "processing":
      return "Scoring…";
    case "ended":
      return "Session complete";
    case "setup":
      return "";
  }
}

function phaseColor(phase: Phase): string {
  if (phase === "listening") return "var(--color-vermillion)";
  if (phase === "speaking") return "var(--color-sumi)";
  if (phase === "processing") return "var(--color-text-faint)";
  if (phase === "ended") return "var(--color-moss)";
  return "var(--color-text-faint)";
}

// Estimate duration of a base64-encoded WAV by reading its header.
function estimateWavB64Ms(b64: string): number {
  try {
    const headerB64 = b64.slice(0, 64);
    const bin = atob(headerB64);
    const header = new Uint8Array(64);
    for (let i = 0; i < bin.length; i++) header[i] = bin.charCodeAt(i);
    const v = new DataView(header.buffer);
    const sampleRate = v.getUint32(24, true);
    const dataSize = v.getUint32(40, true);
    if (!sampleRate || !dataSize) return 0;
    return Math.round((dataSize / (sampleRate * 2)) * 1000);
  } catch {
    return 0;
  }
}
