// Server endpoints wrap the llama-liquid-audio-cli subprocess. We don't
// use llama-liquid-audio-server — its speech-output path crashes
// (ggml-org/llama.cpp PR #18641, WIP).

const DEFAULT_BASE = "";

let baseURL = DEFAULT_BASE;
let ready: boolean | null = null;

export function configure(url: string) {
  baseURL = url.replace(/\/$/, "");
  ready = null;
}

export function getConfig() {
  return { baseURL, ready: ready ?? true };
}

export async function checkReady(timeoutMs = 4_000): Promise<boolean> {
  try {
    const r = await fetch(`${baseURL}/api/health`, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) {
      ready = false;
      return false;
    }
    const j = (await r.json()) as { ready?: boolean };
    ready = !!j.ready;
    return ready;
  } catch {
    ready = false;
    return false;
  }
}

async function post<T>(path: string, body: unknown, timeoutMs = 240_000): Promise<T> {
  const r = await fetch(`${baseURL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try {
      const j = (await r.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return (await r.json()) as T;
}

export async function transcribe(wavB64: string): Promise<string> {
  const j = await post<{ text: string }>("/api/stt", { audio: wavB64 });
  return j.text?.trim() ?? "";
}

export async function tts(text: string): Promise<string> {
  const j = await post<{ audio: string }>("/api/tts", { text });
  return j.audio;
}

export async function generateReport(input: {
  questionCount: number;
  transcript: string;
  strict?: boolean;
}): Promise<string> {
  const j = await post<{ report: string; echo?: boolean }>("/api/report", {
    question_count: input.questionCount,
    transcript: input.transcript,
    strict: !!input.strict,
  });
  if (j.echo) {
    throw new Error("Model echoed the transcript; please retry.");
  }
  return j.report;
}
