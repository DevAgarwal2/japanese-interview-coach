// CLI-only: model never sees audio for follow-up generation, avoiding the
// "describe what I hear" bias of llama.cpp PR #18641 (WIP). Endpoints:
// /api/stt, /api/tts, /api/report.

import type { APIRoute } from "astro";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const prerender = false;

const MODEL_DIR =
  process.env.LFM_MODEL_DIR ||
  join(process.cwd(), "..", "model", "lfm2.5-audio-jp-q8");

const CLI = join(
  MODEL_DIR,
  "runners",
  "macos-arm64",
  "llama-liquid-audio-macos-arm64",
  "llama-liquid-audio-cli",
);

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, "..", "..", "..");
const REPORT_PROMPT = join(PROJECT_ROOT, "prompts", "report.md");

const PATHS = {
  model: join(MODEL_DIR, "LFM2.5-Audio-1.5B-JP-Q8_0.gguf"),
  mmproj: join(MODEL_DIR, "mmproj-LFM2.5-Audio-1.5B-JP-Q8_0.gguf"),
  vocoder: join(MODEL_DIR, "vocoder-LFM2.5-Audio-1.5B-JP-Q8_0.gguf"),
  tokenizer: join(MODEL_DIR, "tokenizer-LFM2.5-Audio-1.5B-JP-Q8_0.gguf"),
};

const NGL = process.env.LFM_NGL ?? "99";

// ====================== helpers ======================

function bad(msg: string, code = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status: code,
    headers: { "Content-Type": "application/json" },
  });
}

function runCli(args: string[], timeoutMs: number): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(CLI, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { child.kill("SIGKILL"); } catch {}
        reject(new Error(`CLI timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    child.stdout.on("data", (b) => {
      stdout += b.toString("utf8");
    });
    child.stderr.on("data", (b) => {
      stderr += b.toString("utf8");
    });
    child.on("error", (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(e);
    });
    child.on("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

function decodeBase64(s: string): Buffer {
  const i = s.indexOf(",");
  const raw = i >= 0 ? s.slice(i + 1) : s;
  return Buffer.from(raw, "base64");
}

function extractText(stdout: string): string {
  const idx = stdout.lastIndexOf("=== GENERATED TEXT ===");
  if (idx >= 0) {
    return stdout.slice(idx + "=== GENERATED TEXT ===".length).trim();
  }
  const lines = stdout.split("\n");
  return lines
    .filter((l) => !/^=|^audio samples|^text tokens|^main:|^srv |^\s*$/.test(l))
    .join("\n")
    .trim();
}

const promptCache = new Map<string, { mtime: number; body: string }>();

async function loadPrompt(path: string): Promise<string> {
  const { stat, readFile } = await import("node:fs/promises");
  const s = await stat(path);
  const cached = promptCache.get(path);
  if (cached && cached.mtime === s.mtimeMs) return cached.body;
  const body = await readFile(path, "utf8");
  promptCache.set(path, { mtime: s.mtimeMs, body });
  return body;
}

function renderTemplate(
  tmpl: string,
  vars: Record<string, string>,
): string {
  let out = tmpl;
  out = out.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, name, body) => (vars[name] ? body : ""),
  );
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v ?? "");
  }
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}

// ====================== endpoints ======================

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, "");
  let body: any;
  try {
    body = await request.json();
  } catch {
    return bad("Invalid JSON body");
  }

  if (path === "stt") return handleStt(body);
  if (path === "tts") return handleTts(body);
  if (path === "report") return handleReport(body);
  return bad(`Unknown endpoint: ${path}`, 404);
};

// ====================== STT ======================

async function handleStt(body: any) {
  if (!body?.audio) return bad("audio is required for stt");
  const workDir = await mkdtemp(join(tmpdir(), "ic-stt-"));
  try {
    const inWav = join(workDir, "in.wav");
    await writeFile(inWav, decodeBase64(body.audio));
    const args = [
      "-m", PATHS.model,
      "--mmproj", PATHS.mmproj,
      "-mv", PATHS.vocoder,
      "--tts-speaker-file", PATHS.tokenizer,
      "-sys", "Perform ASR in japanese.",
      "--audio", inWav,
      "-p", "",
      "-ngl", NGL,
    ];
    let result;
    try {
      result = await runCli(args, 120_000);
    } catch (e: any) {
      return new Response(
        JSON.stringify({ error: e?.message || "STT failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
    const text = extractText(result.stdout);
    if (!text) {
      return new Response(
        JSON.stringify({ error: "No speech detected.", stderr: result.stderr.slice(-1000) }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ text }), {
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ====================== TTS ======================

async function handleTts(body: any) {
  if (!body?.text) return bad("text is required for tts");
  const workDir = await mkdtemp(join(tmpdir(), "ic-tts-"));
  try {
    const outWav = join(workDir, "out.wav");
    const args = [
      "-m", PATHS.model,
      "--mmproj", PATHS.mmproj,
      "-mv", PATHS.vocoder,
      "--tts-speaker-file", PATHS.tokenizer,
      "-sys", "Perform TTS in japanese.",
      "-p", body.text,
      "-o", outWav,
      "-ngl", NGL,
    ];
    let result;
    try {
      result = await runCli(args, 120_000);
    } catch (e: any) {
      return new Response(
        JSON.stringify({ error: e?.message || "TTS failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
    let wav: Buffer;
    try {
      wav = await readFile(outWav);
    } catch {
      return new Response(
        JSON.stringify({ error: "TTS produced no audio.", stderr: result.stderr.slice(-1000) }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({ audio: wav.toString("base64") }),
      { headers: { "Content-Type": "application/json" } },
    );
  } finally {
    rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ====================== REPORT ======================

interface ReportBody {
  question_count: number;
  transcript: string;
  strict?: boolean;
}

async function handleReport(body: ReportBody) {
  if (body?.transcript && body?.question_count) {
    // fall through to model call
  } else {
    return new Response(
      JSON.stringify({
        report: "(レポートを生成できませんでした。回答が記録されていません。)",
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  const tmpl = await loadPrompt(REPORT_PROMPT);
  let rendered = renderTemplate(tmpl, {
    question_count: String(body.question_count),
    transcript: body.transcript,
  });
  if (body.strict) {
    rendered += "\n\n重要: 上のトランスクリプトを要約や引用せず、純粋に新しい日本語のパラグラフだけを書け。Q1: のような行を含めてはならない。最後に「以上」を出力。";
  }
  const sysPrompt = body.strict
    ? "Output ONLY a Japanese paragraph. Do not echo, transcribe, or summarize the prompt above. Do not include Q/A lines."
    : "Complete the user's request. Write the final paragraph in Japanese, do not transcribe or echo the prompt.";

  const workDir = await mkdtemp(join(tmpdir(), "ic-report-"));
  try {
    const outWav = join(workDir, "out.wav");
    const args = [
      "-m", PATHS.model,
      "--mmproj", PATHS.mmproj,
      "-mv", PATHS.vocoder,
      "--tts-speaker-file", PATHS.tokenizer,
      "-sys", sysPrompt,
      "-p", rendered,
      "-n", "800",
      "-o", outWav,
      "-ngl", NGL,
    ];
    let result;
    try {
      result = await runCli(args, 60_000);
    } catch (e: any) {
      return new Response(
        JSON.stringify({ error: e?.message || "Report failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
    const text = extractText(result.stdout);
    if (!text) {
      return new Response(
        JSON.stringify({ error: "No report from model.", stderr: result.stderr.slice(-1000) }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ report: text, echo: looksLikeEcho(text, body.transcript) }), {
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

function looksLikeEcho(text: string, transcript: string): boolean {
  if (!text) return false;
  const head = text.slice(0, 80);
  if (/^Q\d+:/m.test(head)) return true;
  const firstQ = transcript.split("\n").find((l) => /^Q\d+:/i.test(l));
  if (firstQ && text.includes(firstQ.slice(0, 60))) return true;
  return false;
}
