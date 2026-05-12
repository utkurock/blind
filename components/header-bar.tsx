"use client";

import { useEffect, useRef } from "react";

type Props = {
  balance: number;
  risk: number;
  riskLocked: boolean;
  onRiskChange: (v: number) => void;
  onRiskToggleLock: () => void;
  playing: boolean;
  onTogglePlay: () => void;
  hasWallet: boolean;
  onOpenWallet: () => void;
  drandRound: number | null;
  paletteLabel: string;
  onOpenSpin: () => void;
};

export function HeaderBar({
  balance,
  risk,
  riskLocked,
  onRiskChange,
  onRiskToggleLock,
  playing,
  onTogglePlay,
  hasWallet,
  onOpenWallet,
  drandRound,
  paletteLabel,
  onOpenSpin,
}: Props) {
  const dirRef = useRef<1 | -1>(1);
  useEffect(() => {
    if (riskLocked) return;
    const t = setInterval(() => {
      let next = risk + dirRef.current;
      if (next >= 10) { next = 10; dirRef.current = -1; }
      else if (next <= 1) { next = 1; dirRef.current = 1; }
      onRiskChange(next);
    }, 130);
    return () => clearInterval(t);
  }, [risk, riskLocked, onRiskChange]);

  const stake = (balance * risk) / 100;
  return (
    <header className="flex flex-col gap-3 border-b border-line/70 px-4 py-3 backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:px-6">
      {/* row 1: brand + drand round (drand visible on mobile, tagline only on lg) */}
      <div className="flex items-center justify-between gap-4 lg:justify-start">
        <div className="flex items-center gap-4">
          <span className="font-editorial text-2xl font-semibold tracking-tight text-ink">
            blind
          </span>
          <span className="hidden text-[10px] uppercase tracking-[0.2em] text-dim lg:inline">
            a coin flip you didn't make
          </span>
        </div>
        <div className="flex flex-col items-end lg:hidden">
          <span className="label">drand round</span>
          <span className="font-mono text-xs text-ink">{drandRound ?? "—"}</span>
        </div>
      </div>

      {/* row 2 on mobile / inline on lg */}
      <div className="flex flex-wrap items-end gap-3 lg:flex-nowrap lg:items-center lg:gap-5">
        <div className="flex flex-col">
          <span className="label">balance</span>
          <span className="font-mono text-base text-ink">
            {balance.toFixed(2)} <span className="text-dim">xlm</span>
          </span>
        </div>

        <div className="hidden h-8 w-px bg-line lg:block" />

        <div className="flex w-full max-w-[16rem] flex-col lg:w-64">
          <div className="flex items-center justify-between">
            <span className="label">risk</span>
            <span className="font-mono text-xs text-ink">
              {risk}/10 <span className="text-dim">·</span> {stake.toFixed(2)}
            </span>
          </div>
          <button
            type="button"
            onClick={onRiskToggleLock}
            disabled={!hasWallet}
            title={riskLocked ? "click to roll" : "click to lock"}
            className={
              "risk-track mt-1.5 flex h-5 items-center justify-between rounded-sm border px-1.5 transition " +
              (riskLocked
                ? "border-ink/50 bg-ink/5 hover:border-ink/75"
                : "border-ink/70 bg-ink/10 hover:border-ink cursor-crosshair") +
              (!hasWallet ? " opacity-40 cursor-not-allowed" : "")
            }
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <span
                key={n}
                className={
                  "risk-dot rounded-full transition-all duration-100 " +
                  (n === risk
                    ? "risk-dot-on h-2 w-2 bg-ink"
                    : "h-1 w-1 bg-ink/55")
                }
              />
            ))}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:gap-3">
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={!hasWallet}
            className={"pill " + (playing ? "pill-short" : "pill-long")}
          >
            {playing ? "pause" : "play"}
          </button>

          <button type="button" onClick={onOpenWallet} className="pill">
            {hasWallet ? "wallet" : "create wallet"}
          </button>

          <button type="button" onClick={onOpenSpin} className="pill" title="spin palette">
            <span className="opacity-60">◐</span>
            <span>{paletteLabel}</span>
          </button>
        </div>

        <div className="ml-auto hidden flex-col items-end lg:flex">
          <span className="label">drand round</span>
          <span className="font-mono text-xs text-ink">{drandRound ?? "—"}</span>
        </div>
      </div>
    </header>
  );
}
