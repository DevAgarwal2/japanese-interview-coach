"use client";
import { useRef, useCallback, useState, useEffect } from "react";

const SILENCE_THRESHOLD = 0.012;
const SILENCE_MS = 1500;
const MIN_SPEECH_MS = 500;
const SPEECH_RMS = 0.02;

export interface UseVoiceModeOpts {
  onRecording: (blob: Blob) => void;
  onAmplitude?: (amp: number) => void; // 0..1, called ~60fps while listening
  onLevelChange?: (level: "silence" | "speech") => void;
}

export interface UseVoiceMode {
  start: () => Promise<void>;
  stop: () => void;
  recording: boolean;
  durationMs: number;
  level: "silence" | "speech";
  amplitude: number;
}

// VAD: silence for SILENCE_MS auto-stops so the user can speak without a hotkey.
export function useVoiceMode(opts: UseVoiceModeOpts): UseVoiceMode {
  const [recording, setRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [level, setLevel] = useState<"silence" | "speech">("silence");
  const [amplitude, setAmplitude] = useState(0);

  const mrRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const hasSpeechRef = useRef(false);
  const levelRef = useRef<"silence" | "speech">("silence");
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (silenceRef.current) {
      clearTimeout(silenceRef.current);
      silenceRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (ctxRef.current && ctxRef.current.state !== "closed") {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
    analyserRef.current = null;
    mrRef.current = null;
    setAmplitude(0);
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const monitor = useCallback(() => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const x = (data[i] - 128) / 128;
      sum += x * x;
    }
    const rms = Math.sqrt(sum / data.length);
    const amp = Math.min(1, rms * 3.2);
    setAmplitude(amp);
    opts.onAmplitude?.(amp);

    if (rms > SPEECH_RMS) {
      if (!hasSpeechRef.current) {
        hasSpeechRef.current = true;
      }
      if (levelRef.current !== "speech") {
        levelRef.current = "speech";
        setLevel("speech");
        opts.onLevelChange?.("speech");
      }
      if (silenceRef.current) {
        clearTimeout(silenceRef.current);
        silenceRef.current = null;
      }
    } else if (rms < SILENCE_THRESHOLD) {
      if (!silenceRef.current && hasSpeechRef.current) {
        silenceRef.current = setTimeout(() => {
          if (mrRef.current?.state === "recording") mrRef.current.stop();
        }, SILENCE_MS);
      }
    }
    rafRef.current = requestAnimationFrame(monitor);
  }, [opts]);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      chunksRef.current = [];
      hasSpeechRef.current = false;
      levelRef.current = "silence";
      startTimeRef.current = Date.now();
      setDurationMs(0);
      setLevel("silence");

      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      analyserRef.current = analyser;
      monitor();

      tickRef.current = setInterval(() => {
        setDurationMs(Date.now() - startTimeRef.current);
      }, 100);

      const mr = new MediaRecorder(stream, {
        mimeType: pickMime(),
      });
      mrRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const duration = Date.now() - startTimeRef.current;
        cleanup();
        setRecording(false);
        if (!hasSpeechRef.current || duration < MIN_SPEECH_MS) return;
        if (chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        opts.onRecording(blob);
      };
      mr.start(100);
      setRecording(true);
    } catch (e) {
      console.error("Mic access error:", e);
      alert("Please allow microphone access to use voice mode.");
    }
  }, [opts, monitor, cleanup]);

  const stop = useCallback(() => {
    if (mrRef.current?.state === "recording") mrRef.current.stop();
  }, []);

  return { start, stop, recording, durationMs, level, amplitude };
}

function pickMime(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "audio/webm";
}
