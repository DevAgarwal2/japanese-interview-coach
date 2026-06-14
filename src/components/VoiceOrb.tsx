"use client";
import { useEffect, useId, useState } from "react";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

interface Props {
  state: OrbState;
  amplitude?: number; // 0..1, from useVoiceMode
  size?: number;
}

export default function VoiceOrb({ state, amplitude = 0, size = 220 }: Props) {
  const id = useId();

  // rAF-driven so the disc doesn't have to wait for React's render cycle.
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    if (state !== "listening") return;
    let raf = 0;
    const tick = () => {
      setPulse(amplitude);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, amplitude]);

  const innerR = size * 0.32;
  const listenR = innerR + pulse * 14;
  const haloR = innerR + 38 + pulse * 22;

  return (
    <svg width={size} height={size} viewBox="0 0 200 200" className="block">
      <defs>
        <radialGradient id={`grad-${id}`} cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="oklch(36% 0.06 25)" />
          <stop offset="100%" stopColor="oklch(18% 0.03 55)" />
        </radialGradient>
        <radialGradient id={`halo-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="oklch(50% 0.19 25 / 0)" />
          <stop offset="100%" stopColor="oklch(50% 0.19 25 / 0.10)" />
        </radialGradient>
      </defs>

      {state !== "idle" && state !== "thinking" && (
        <circle
          cx="100"
          cy="100"
          r={haloR}
          fill={`url(#halo-${id})`}
          className={state === "listening" ? "animate-orb-pulse" : ""}
        />
      )}

      <circle
        cx="100"
        cy="100"
        r={state === "listening" ? listenR : innerR}
        fill={`url(#grad-${id})`}
        style={{
          transition: state === "listening" ? "r 80ms ease-out" : "r 300ms cubic-bezier(0.22,1,0.36,1)",
        }}
      />

      <circle
        cx="100"
        cy="100"
        r={state === "listening" ? listenR - 6 : innerR - 6}
        fill="none"
        stroke="oklch(99% 0.002 55 / 0.18)"
        strokeWidth="0.8"
      />

      {state === "idle" && (
        <circle cx="100" cy="100" r="3.2" fill="oklch(99% 0.002 55)" />
      )}

      {state === "listening" && (
        <g>
          {[0, 1, 2].map((i) => {
            const offset = (i - 1) * 9;
            const base = 8;
            const tall = base + amplitude * 24;
            return (
              <rect
                key={i}
                x={100 + offset - 2}
                y={100 - tall / 2}
                width="4"
                height={tall}
                rx="2"
                fill="oklch(99% 0.002 55 / 0.92)"
                style={{ transition: "height 60ms ease-out, y 60ms ease-out" }}
              />
            );
          })}
        </g>
      )}

      {state === "thinking" && (
        <g className="animate-orb-think" style={{ transformOrigin: "100px 100px" }}>
          <path
            d="M 100,80 a 20,20 0 1 1 -14,6"
            fill="none"
            stroke="oklch(99% 0.002 55 / 0.85)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </g>
      )}

      {state === "speaking" && (
        <g>
          {[0, 1, 2, 3, 4].map((i) => {
            const angle = (i / 5) * Math.PI * 2;
            const r = 14;
            const cx = 100 + Math.cos(angle) * r;
            const cy = 100 + Math.sin(angle) * r;
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r="1.6"
                fill="oklch(99% 0.002 55 / 0.9)"
                style={{
                  animation: `orbThink 4s linear infinite`,
                  animationDelay: `${-i * 0.8}s`,
                  transformOrigin: "100px 100px",
                }}
              />
            );
          })}
        </g>
      )}
    </svg>
  );
}
