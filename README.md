# Japanese Interview Coach (面接練習)

A voice-based mock-interview practice app for Japanese-speaking job seekers. Pick a role, get interviewed in Japanese by voice, and receive a written report at the end.

The app runs **entirely on-device** on macOS Apple Silicon. Inference uses Liquid AI's `LFM2.5-Audio-1.5B-JP` model via the prebuilt `llama-liquid-audio-cli` runner. No cloud, no API keys.

## What it does

- **STT** — transcribes your Japanese voice answers to text
- **TTS** — speaks each interview question in Japanese
- **Report** — at the end of the session, writes a Japanese paragraph summarizing your performance

## Prerequisites

- **macOS on Apple Silicon** (M1 / M2 / M3 / M4). The runner uses Metal for GPU offload; CPU-only works but is slower.
- **Node.js 22+** and **npm** (for the web app)
- **Python 3.11+** and [**uv**](https://docs.astral.sh/uv/) (preferred) or **pip** — only for the one-time model download
- **~3 GB free disk** for the model files
- **A working microphone** in the browser (Chrome / Safari / Edge)
- **`git`** for cloning the repo

## 1. Clone the repository

```bash
git clone https://github.com/DevAgarwal2/japanese-interview-coach.git
cd japanese-interview-coach
```

## 2. Download the model

The app expects four GGUF files plus the prebuilt `llama-liquid-audio-cli` runner. The default path is `../model/lfm2.5-audio-jp-q8/` (one directory up from the project). You can override this with the `LFM_MODEL_DIR` environment variable.

Install the [`hf` CLI](https://huggingface.co/docs/huggingface_hub/en/guides/cli) (the new name for `huggingface-cli`):

```bash
# uv (recommended) — installs the `hf` command globally
uv tool install huggingface_hub

# pip
pip install -U "huggingface_hub"

# or run without installing at all
uvx hf auth login
```

Then authenticate (you need a [User Access Token](https://huggingface.co/settings/tokens)):

```bash
hf auth login
```

Now download the model:

```bash
hf download LiquidAI/LFM2.5-Audio-1.5B-JP-GGUF \
  --local-dir ../model/lfm2.5-audio-jp-q8 \
  --local-dir-use-symlinks False
```

> The PyPI package is `huggingface_hub`; the CLI command is `hf` (replaces the deprecated `huggingface-cli`).

After download you should have:

```
../model/lfm2.5-audio-jp-q8/
├── LFM2.5-Audio-1.5B-JP-Q8_0.gguf        # ~1.2 GB  (language model)
├── mmproj-LFM2.5-Audio-1.5B-JP-Q8_0.gguf  # ~280 MB  (audio encoder)
├── vocoder-LFM2.5-Audio-1.5B-JP-Q8_0.gguf # ~200 MB  (audio decoder)
├── tokenizer-LFM2.5-Audio-1.5B-JP-Q8_0.gguf # ~70 MB  (audio tokenizer)
└── runners/
    └── macos-arm64/
        └── llama-liquid-audio-macos-arm64/
            └── llama-liquid-audio-cli    # the runner binary (executable)
```

> The `-JP-` variant is Japanese-tuned. The base `LFM2.5-Audio-1.5B` (without `-JP-`) is multilingual but the prompts and persona strings in this app are Japanese-only.

## 3. Install dependencies

```bash
npm install
```

## 4. Run

```bash
npm run dev
```

Open `http://localhost:4321` in your browser. The status pill in the top-right should turn green `connected` within a second — this confirms the model and CLI binary are detected.

## 5. Use

1. Pick a role (Software Engineer, PM, Data Scientist, …).
2. Pick a difficulty, a voice tone, and a length.
3. Click **Start the interview**.
4. The first question plays in Japanese. Hold the mic, speak, release.
5. After each answer, the model transcribes it and the next question is asked.
6. After the last question, the model writes a Japanese report.

## Configuration

All configuration is through environment variables, read once at server start.

| Env var | Default | Purpose |
| --- | --- | --- |
| `LFM_MODEL_DIR` | `../model/lfm2.5-audio-jp-q8` | Where the GGUF files and runner live. |
| `LFM_NGL` | `99` | GPU layers for `llama-liquid-audio-cli`. Set to `0` to force CPU-only (slower, but works around the WIP Metal bug described below). |
| `LFM_SERVER_URL` | *(unused)* | Reserved for future server-mode support. |

Example — CPU mode:

```bash
LFM_NGL=0 npm run dev
```

## Project layout

```
japanese-interview-coach/
├── src/
│   ├── components/        # React + Astro components
│   │   ├── Interview.tsx
│   │   ├── VoiceOrb.tsx
│   │   ├── layout/
│   │   ├── session/
│   │   └── setup/
│   ├── lib/               # client-side helpers
│   │   ├── api.ts         # API client
│   │   ├── audio.ts       # 16kHz WAV encoder
│   │   ├── categories.ts  # job roles, difficulty, tone
│   │   ├── useVoiceMode.ts
│   │   └── utils.ts
│   ├── pages/
│   │   ├── index.astro    # landing page
│   │   └── api/
│   │       ├── health.ts  # GET /api/health
│   │       └── [...path].ts  # POST /api/stt, /api/tts, /api/report
│   ├── styles/global.css
│   ├── layouts/BaseLayout.astro
│   └── env.d.ts
├── prompts/
│   └── report.md          # template for the final report
├── public/
│   ├── favicon.svg
│   └── hero.jpg
├── astro.config.mjs
├── tsconfig.json
├── package.json
└── README.md
```

The GGUF models and runner live **outside** this repo at `../model/lfm2.5-audio-jp-q8/` (or wherever `LFM_MODEL_DIR` points).

## Build for production

```bash
npm run build      # builds the Node SSR bundle into dist/
npm run preview    # serves the production build locally
node dist/server/entry.mjs   # production server (port 4321)
```

The build emits a standalone Node entrypoint — no external process manager required. For deployment behind a reverse proxy (nginx, Caddy, …), point it at port 4321.

## API

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| `GET` | `/api/health` | — | `{"ready": true}` if the model and runner are present |
| `POST` | `/api/stt` | `{ "audio": "<base64 16kHz mono WAV>" }` | `{"text": "<Japanese transcript>"}` |
| `POST` | `/api/tts` | `{ "text": "<Japanese text>" }` | `{"audio": "<base64 WAV>"}` |
| `POST` | `/api/report` | `{ "question_count": N, "transcript": "Q1: ...\nA: ...\n\n...", "strict"?: bool }` | `{"report": "<Japanese paragraph ending in 以上>"}` |

`/api/report` falls back to a Japanese placeholder when `transcript` or `question_count` is missing, so the client never sees a 4xx for that endpoint.

## Troubleshooting

### "connected" pill stays red / `GET /api/health` returns `{"ready": false}`

The app can't find the CLI binary or the GGUF files. Verify:

```bash
ls -la ../model/lfm2.5-audio-jp-q8/runners/macos-arm64/llama-liquid-audio-macos-arm64/llama-liquid-audio-cli
ls -la ../model/lfm2.5-audio-jp-q8/*.gguf
```

If you put the model somewhere else, set `LFM_MODEL_DIR=/your/path npm run dev`.

### Browser asks for microphone permission but nothing records

Use `localhost` (not the LAN IP). Chrome blocks the mic on `http://` over LAN unless you're on HTTPS. The dev server binds to `localhost` by default.

### `ggml_metal_device_init` / `ggml_abort` crash on report generation

This is an upstream bug in [ggml-org/llama.cpp PR #18641](https://github.com/ggml-org/llama.cpp/pull/18641) (WIP). Metal init sometimes fails on the first process spawn after a system sleep, a cold boot, or a long idle period. Workarounds:

1. **Run in CPU mode** — slower, but bypasses Metal entirely:

   ```bash
   LFM_NGL=0 npm run dev
   ```

2. **Retry** — Metal init usually succeeds on the second process spawn. The app retries once automatically when the model echoes the transcript; for a hard crash, just click End / Start again.

3. **Reboot** if Metal stays wedged.

### First turn takes ~10 seconds

The CLI loads the 1.2 GB model from disk on the first request of each session. Subsequent turns in the same session are faster (no reload), but the architecture currently reloads per request. Concurrent CLI processes contend for Metal — keep the app to one interview at a time.

### STT mis-transcribes English as garbled Japanese

The `-JP-` model variant is Japanese-only. Speak Japanese, or switch to the multilingual `LFM2.5-Audio-1.5B` (no `-JP-`) variant — but then the app's prompts and personas will still be Japanese.

## License

- Model: [Liquid AI LFM2.5-Audio-1.5B-JP](https://huggingface.co/LiquidAI/LFM2.5-Audio-1.5B-JP-GGUF) — see the model card for license terms.
- Inference: [`llama.cpp` with the WIP `LFM2.5-Audio` PR #18641](https://github.com/ggml-org/llama.cpp/pull/18641). The CLI runner is prebuilt and shipped with the model on Hugging Face.
- This app: MIT (or whatever you prefer).
