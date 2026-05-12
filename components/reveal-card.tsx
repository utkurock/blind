"use client";

import type { DerivedRound } from "@/lib/derive";
import { outcomeLabel } from "@/lib/derive";

export type CyclePhase =
  | "idle"
  | "asset-spin"
  | "asset-hold"
  | "side-spin"
  | "side-hold"
  | "mult-spin"
  | "open"
  | "settled"
  | "cooldown";

type Props = {
  phase: CyclePhase;
  round: number | null;
  revealAsset: string | null;
  revealSide: "long" | "short" | null;
  revealMult: number | null;
  lastSettled: (DerivedRound & { stake: number; pnl: number }) | null;
  pnlVisible: boolean;
};

const SPIN_PHASES = new Set<CyclePhase>(["asset-spin", "side-spin", "mult-spin"]);

export function RevealCard({
  phase,
  round,
  revealAsset,
  revealSide,
  revealMult,
  lastSettled,
  pnlVisible,
}: Props) {
  const live = phase !== "idle" && phase !== "cooldown";

  const assetSpinning = phase === "asset-spin";
  const sideSpinning  = phase === "side-spin";
  const multSpinning  = phase === "mult-spin";

  const assetShown = revealAsset != null;
  const sideShown  = revealSide  != null;
  const multShown  = revealMult  != null;

  const assetText = assetShown ? revealAsset! : "???";
  const sideText  = sideShown  ? revealSide!.toUpperCase() : "??";
  const multText  = multShown  ? `${Math.round(revealMult!)}x` : "?.??x";

  const sideColor =
    sideShown
      ? revealSide === "long" ? "text-long" : "text-short"
      : "text-dim/70";

  const outcomePnlColor = (kind?: string, pnl?: number) => {
    if (kind === "liq" || kind === "small_loss") return "text-short text-glow-short";
    if (kind === "tp" || kind === "small_profit") return "text-long text-glow-long";
    return (pnl ?? 0) >= 0 ? "text-long text-glow-long" : "text-short text-glow-short";
  };

  return (
    <div className={"panel-soft rounded-lg p-4 transition sm:p-5 " + (live ? "live-ring" : "")}>
      <div className="flex items-center justify-between">
        <span className="tag">trade</span>
        {round != null && (
          <span className="font-mono text-[11px] text-dim">round {round}</span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-12 items-center gap-3 sm:mt-5 sm:gap-4">
        <div className="col-span-4">
          <div className="label">asset</div>
          <div
            className={
              "font-editorial text-2xl transition-all duration-150 sm:text-3xl lg:text-4xl " +
              (assetSpinning ? "text-ink/80 blur-[0.4px]" : assetShown ? "text-ink text-glow-soft" : "text-dim/70")
            }
          >
            {assetText}
          </div>
        </div>
        <div className="col-span-4">
          <div className="label">side</div>
          <div
            className={
              "font-editorial text-2xl transition-all duration-150 sm:text-3xl lg:text-4xl " +
              sideColor +
              (sideSpinning ? " blur-[0.4px]" : "")
            }
          >
            {sideText}
          </div>
        </div>
        <div className="col-span-4">
          <div className="label">leverage</div>
          <div
            className={
              "font-editorial text-2xl transition-all duration-150 sm:text-3xl lg:text-4xl " +
              (multSpinning ? "text-ink/80 blur-[0.4px]" : multShown ? "text-ink" : "text-dim/70")
            }
          >
            {multText}
          </div>
        </div>
      </div>

      <div className="h-divider mt-5" />

      <div className="mt-4 flex items-center justify-between">
        <span className="tag">last settled</span>
        {lastSettled && (
          <span className="font-mono text-[11px] text-dim">
            stake {lastSettled.stake.toFixed(2)} xlm
          </span>
        )}
      </div>

      {lastSettled ? (
        <div
          key={`settled-${lastSettled.asset}-${lastSettled.multiplier}-${lastSettled.pnl}`}
          className="flip-in mt-4 grid grid-cols-12 items-center gap-3 sm:gap-4"
        >
          <div className="col-span-4 sm:col-span-3">
            <div className="label">asset</div>
            <div className="font-editorial text-2xl text-ink text-glow-soft sm:text-3xl">
              {lastSettled.asset}
            </div>
          </div>
          <div className="col-span-4 sm:col-span-2">
            <div className="label">side</div>
            <div
              className={
                "font-editorial text-2xl sm:text-3xl " +
                (lastSettled.side === "long" ? "text-long text-glow-long" : "text-short text-glow-short")
              }
            >
              {lastSettled.side}
            </div>
          </div>
          <div className="col-span-4 sm:col-span-2">
            <div className="label">lev</div>
            <div className="font-editorial text-2xl text-ink sm:text-3xl">
              {Math.round(lastSettled.multiplier)}<span className="text-dim">x</span>
            </div>
          </div>
          <div className="col-span-6 sm:col-span-2">
            <div className="label">outcome</div>
            {pnlVisible ? (
              <div
                className={
                  "font-mono text-[12px] uppercase tracking-[0.12em] flip-in sm:text-[13px] " +
                  outcomePnlColor(lastSettled.outcomeKind, lastSettled.pnl)
                }
              >
                {outcomeLabel(lastSettled.outcomeKind)}
              </div>
            ) : (
              <div className="font-mono text-[12px] uppercase tracking-[0.12em] text-dim/60 sm:text-[13px]">
                <span className="animate-pulse">···</span>
              </div>
            )}
          </div>
          <div className="col-span-6 text-right sm:col-span-3">
            <div className="label">pnl</div>
            {pnlVisible ? (
              <div
                className={
                  "font-editorial text-2xl flip-in sm:text-3xl " +
                  outcomePnlColor(lastSettled.outcomeKind, lastSettled.pnl)
                }
              >
                {lastSettled.pnl >= 0 ? "+" : ""}
                {lastSettled.pnl.toFixed(2)}
              </div>
            ) : (
              <div className="font-editorial text-2xl text-dim/60 sm:text-3xl">
                <span className="animate-pulse">···</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-baseline gap-3">
          <span className="font-editorial text-2xl italic text-dim">
            you don't pick.
          </span>
          <span className="font-editorial text-2xl text-ink">drand does.</span>
        </div>
      )}
    </div>
  );
}
