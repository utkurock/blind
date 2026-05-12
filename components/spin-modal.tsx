"use client";

import { useEffect, useRef, useState } from "react";
import {
  PALETTES,
  CHART_STYLES,
  pickPaletteIndex,
  pickChartStyleIndex,
  type Palette,
  type ChartStyle,
  type ChartStyleId,
} from "@/lib/palettes";
import { fetchOnce } from "@/lib/drand";

type Phase = "ready" | "spinning" | "chose";

type Props = {
  open: boolean;
  currentPalette: string | null;
  currentChartStyle: ChartStyleId;
  onClose: () => void;
  onApply: (p: Palette, s: ChartStyle) => void;
};

const StyleIcon = ({ id }: { id: ChartStyleId }) => {
  switch (id) {
    case "candle":
      return (
        <svg viewBox="0 0 24 16" className="h-4 w-6" fill="currentColor">
          <rect x="2" y="4" width="3" height="8" />
          <line x1="3.5" y1="1" x2="3.5" y2="15" stroke="currentColor" strokeWidth="1" />
          <rect x="9" y="2" width="3" height="11" />
          <line x1="10.5" y1="0" x2="10.5" y2="15" stroke="currentColor" strokeWidth="1" />
          <rect x="16" y="5" width="3" height="7" />
          <line x1="17.5" y1="3" x2="17.5" y2="14" stroke="currentColor" strokeWidth="1" />
        </svg>
      );
    case "bar":
      return (
        <svg viewBox="0 0 24 16" className="h-4 w-6" stroke="currentColor" strokeWidth="1.2" fill="none">
          <line x1="3" y1="2"  x2="3" y2="14" />
          <line x1="1" y1="6"  x2="3" y2="6"  />
          <line x1="3" y1="10" x2="5" y2="10" />
          <line x1="10" y1="4" x2="10" y2="13" />
          <line x1="8"  y1="7" x2="10" y2="7"  />
          <line x1="10" y1="11" x2="12" y2="11" />
          <line x1="17" y1="3" x2="17" y2="13" />
          <line x1="15" y1="5" x2="17" y2="5"  />
          <line x1="17" y1="10" x2="19" y2="10" />
        </svg>
      );
    case "line":
      return (
        <svg viewBox="0 0 24 16" className="h-4 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2,11 6,7 10,9 14,4 18,8 22,5" />
        </svg>
      );
    case "area":
      return (
        <svg viewBox="0 0 24 16" className="h-4 w-6" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.25" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2,11 L6,7 L10,9 L14,4 L18,8 L22,5 L22,15 L2,15 Z" />
        </svg>
      );
  }
};

export function SpinModal({ open, currentPalette, currentChartStyle, onClose, onApply }: Props) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [hiPalette, setHiPalette] = useState(0);
  const [hiStyle, setHiStyle] = useState(0);
  const [chosenPalette, setChosenPalette] = useState<Palette | null>(null);
  const [chosenStyle, setChosenStyle] = useState<ChartStyle | null>(null);
  const [round, setRound] = useState<number | null>(null);
  const [randHex, setRandHex] = useState<string | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setPhase("ready");
      setChosenPalette(null);
      setChosenStyle(null);
      setRound(null);
      setRandHex(null);
      cancelRef.current = false;
      const pIdx = PALETTES.findIndex((p) => p.id === currentPalette);
      const sIdx = CHART_STYLES.findIndex((s) => s.id === currentChartStyle);
      setHiPalette(pIdx >= 0 ? pIdx : 0);
      setHiStyle(sIdx >= 0 ? sIdx : 0);
    }
  }, [open, currentPalette, currentChartStyle]);

  if (!open) return null;

  const spin = async () => {
    if (phase === "spinning") return;
    setPhase("spinning");
    setChosenPalette(null);
    setChosenStyle(null);
    cancelRef.current = false;

    const r = await fetchOnce();
    if (!r) {
      setPhase("ready");
      return;
    }
    setRound(r.round);
    setRandHex(r.randomness);
    const pTarget = pickPaletteIndex(r.randomness);
    const sTarget = pickChartStyleIndex(r.randomness);

    // Two-stage spin. Palette row spins first and lands, then the chart-style row
    // spins and lands. Each stage eases out into its target.
    const PALETTE_MS = 1800;
    const STYLE_GAP_MS = 250; // brief breath between the two stages
    const STYLE_MS = 1400;

    const finish = () => {
      const p = PALETTES[pTarget];
      const s = CHART_STYLES[sTarget];
      setHiPalette(pTarget);
      setHiStyle(sTarget);
      setChosenPalette(p);
      setChosenStyle(s);
      setPhase("chose");
      onApply(p, s);
    };

    // ----- stage 1: palette -----
    const paletteStart = performance.now();
    let pi = hiPalette;

    const tickPalette = () => {
      if (cancelRef.current) return;
      const elapsed = performance.now() - paletteStart;
      const progress = Math.min(1, elapsed / PALETTE_MS);

      if (progress >= 0.75) {
        // lock-in tail: walk straight to target
        const dist = (pTarget - pi + PALETTES.length) % PALETTES.length;
        if (dist === 0) {
          setHiPalette(pTarget);
          setTimeout(tickStyle, STYLE_GAP_MS);
          return;
        }
        pi = (pi + 1) % PALETTES.length;
        setHiPalette(pi);
      } else {
        pi = (pi + 1) % PALETTES.length;
        setHiPalette(pi);
      }

      const interval = 55 + progress * progress * 110;
      setTimeout(tickPalette, interval);
    };

    // ----- stage 2: chart style -----
    let styleStartTs = 0;
    let si = hiStyle;

    const tickStyle = () => {
      if (cancelRef.current) return;
      if (styleStartTs === 0) styleStartTs = performance.now();
      const elapsed = performance.now() - styleStartTs;
      const progress = Math.min(1, elapsed / STYLE_MS);

      if (progress >= 0.7) {
        const dist = (sTarget - si + CHART_STYLES.length) % CHART_STYLES.length;
        if (dist === 0) {
          finish();
          return;
        }
        si = (si + 1) % CHART_STYLES.length;
        setHiStyle(si);
      } else {
        si = (si + 1) % CHART_STYLES.length;
        setHiStyle(si);
      }

      const interval = 90 + progress * progress * 140;
      setTimeout(tickStyle, interval);
    };

    setTimeout(tickPalette, 50);
  };

  return (
    <div
      onClick={() => {
        cancelRef.current = true;
        onClose();
      }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 px-3 py-4 backdrop-blur sm:items-center sm:px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel-soft max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl p-5 sm:p-6"
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="tag">palette spin</span>
          <button
            onClick={() => {
              cancelRef.current = true;
              onClose();
            }}
            className="pill"
          >
            close
          </button>
        </div>

        <h2 className="font-editorial text-2xl leading-[1.05] text-ink sm:text-3xl">
          {phase === "ready" && (
            <>
              the chain picks <span className="italic text-dim">everything.</span><br />
              even the colour. even the shape.
            </>
          )}
          {phase === "spinning" && (
            <>
              drand is <span className="italic">choosing</span>…
            </>
          )}
          {phase === "chose" && chosenPalette && chosenStyle && (
            <>
              drand chose <span className="italic">{chosenPalette.label}</span>
              <span className="text-dim"> · </span>
              <span className="italic">{chosenStyle.label}</span>.
            </>
          )}
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-muted">
          {phase === "ready" && "One round is fetched. 32 bits mod 10 → palette. Next 32 bits mod 4 → chart. Just watch."}
          {phase === "spinning" && "fetching round…"}
          {phase === "chose" && round && randHex && (
            <>
              round <span className="font-mono text-ink">{round}</span>
              <span className="mx-2 text-dim/60">·</span>
              <span className="font-mono text-ink">{randHex.slice(2, 14)}…</span>
            </>
          )}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {PALETTES.map((p, idx) => {
            const isHi = phase !== "ready" && idx === hiPalette;
            const isFinal = phase === "chose" && chosenPalette?.id === p.id;
            return (
              <div
                key={p.id}
                className={
                  "relative rounded-md border p-2 text-left transition " +
                  (isFinal
                    ? "border-ink/70 bg-ink/[0.06]"
                    : isHi
                    ? "border-ink/40 bg-ink/[0.04]"
                    : "border-line/70 bg-bg/40")
                }
                style={{
                  transform: isHi && phase === "spinning" ? "scale(1.02)" : "scale(1)",
                  transition: "all 120ms ease",
                }}
              >
                <div className="flex gap-1">
                  {p.swatches.map((c, i) => (
                    <span
                      key={i}
                      className="h-5 w-5 rounded-sm"
                      style={{ background: c, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)" }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-mono text-[11px] lowercase tracking-[0.1em] text-ink">
                    {p.label}
                  </span>
                  {currentPalette === p.id && phase === "ready" && (
                    <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-dim">
                      now
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {CHART_STYLES.map((s, idx) => {
            const isHi = phase !== "ready" && idx === hiStyle;
            const isFinal = phase === "chose" && chosenStyle?.id === s.id;
            return (
              <div
                key={s.id}
                className={
                  "flex items-center gap-2 rounded-md border px-3 py-2 transition " +
                  (isFinal
                    ? "border-ink/70 bg-ink/[0.06] text-ink"
                    : isHi
                    ? "border-ink/40 bg-ink/[0.04] text-ink"
                    : "border-line/70 bg-bg/40 text-ink/80")
                }
                style={{
                  transform: isHi && phase === "spinning" ? "scale(1.02)" : "scale(1)",
                  transition: "all 120ms ease",
                }}
              >
                <StyleIcon id={s.id} />
                <span className="font-mono text-[11px] lowercase tracking-[0.1em]">{s.label}</span>
                {currentChartStyle === s.id && phase === "ready" && (
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.18em] text-dim">
                    now
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={spin}
          disabled={phase === "spinning"}
          className={"pill mt-6 w-full justify-center py-3 text-sm " + (phase === "spinning" ? "" : "pill-long")}
        >
          {phase === "ready" && "spin · let drand pick"}
          {phase === "spinning" && "rolling…"}
          {phase === "chose" && "spin again"}
        </button>
      </div>
    </div>
  );
}
