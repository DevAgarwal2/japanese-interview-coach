import type { APIRoute } from "astro";
import { existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
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

const PROMPTS = {
  report: join(PROJECT_ROOT, "prompts", "report.md"),
};

export const GET: APIRoute = async () => {
  const ready = existsSync(CLI) && existsSync(PROMPTS.report);
  return new Response(JSON.stringify({ ready }), {
    headers: { "Content-Type": "application/json" },
  });
};
