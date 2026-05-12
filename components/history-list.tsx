"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { StoredHistoryItem } from "@/lib/storage";

const STALE_FALLBACK_MS = 20_000; // after this, item with no hash falls back to wallet link

type Props = {
  items: StoredHistoryItem[];
  playPublicKey?: string | null;
};

function outcomeShort(o?: StoredHistoryItem["outcome"]): string {
  switch (o) {
    case "liq":          return "LIQ";
    case "tp":           return "TP";
    case "small_profit": return "WIN";
    case "small_loss":   return "LOSS";
    default:             return "";
  }
}

type RowLinkState = "tx" | "pending" | "stale";

function Row({
  it,
  playPublicKey,
  state,
  children,
}: {
  it: StoredHistoryItem;
  playPublicKey?: string | null;
  state: RowLinkState;
  children: ReactNode;
}) {
  const cls =
    "flex items-center justify-between gap-2 px-4 py-3 transition";
  if (state === "tx" && it.txHash) {
    return (
      <a
        href={`https://stellar.expert/explorer/testnet/tx/${it.txHash}`}
        target="_blank"
        rel="noreferrer"
        className={cls + " cursor-pointer hover:bg-ink/[0.05]"}
        title="open settlement tx on stellar.expert"
      >
        {children}
      </a>
    );
  }
  if (state === "stale" && playPublicKey) {
    return (
      <a
        href={`https://stellar.expert/explorer/testnet/account/${playPublicKey}`}
        target="_blank"
        rel="noreferrer"
        className={cls + " cursor-pointer hover:bg-ink/[0.04]"}
        title="tx not captured — open wallet history on stellar.expert"
      >
        {children}
      </a>
    );
  }
  // pending: non-clickable
  return <div className={cls + " cursor-default"}>{children}</div>;
}

export function HistoryList({ items, playPublicKey }: Props) {
  // tick every second so pending rows transition to "stale" after the timeout
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const hasPending = items.some((it) => !it.txHash && Date.now() - it.ts < STALE_FALLBACK_MS);
    if (!hasPending) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [items]);

  return (
    <div className="panel-soft flex h-full flex-col overflow-hidden rounded-lg">
      <div className="flex items-center justify-between border-b border-line/70 px-4 py-3">
        <span className="tag">activity</span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-dim">{items.length} trades</span>
          {playPublicKey && (
            <a
              href={`https://stellar.expert/explorer/testnet/account/${playPublicKey}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] uppercase tracking-[0.15em] text-dim hover:text-ink"
              title="open play wallet on stellar.expert"
            >
              on-chain ↗
            </a>
          )}
        </div>
      </div>
      <div className="no-scrollbar flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <span className="font-editorial text-xl italic text-dim">no echoes yet.</span>
            <span className="label mt-2">press play, drand starts writing.</span>
          </div>
        ) : (
          <ul className="divide-y divide-line/60">
            {items.map((it) => {
              const ageMs = now - it.ts;
              const state: RowLinkState = it.txHash
                ? "tx"
                : ageMs > STALE_FALLBACK_MS
                ? "stale"
                : "pending";
              return (
                <li key={`${it.round}-${it.ts}`}>
                  <Row it={it} playPublicKey={playPublicKey} state={state}>
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={
                          "font-mono text-[10px] uppercase " +
                          (it.side === "long" ? "text-long" : "text-short")
                        }
                      >
                        {it.side === "long" ? "▲" : "▼"}
                      </span>
                      <span className="font-editorial text-base text-ink">{it.asset}</span>
                      <span className="font-mono text-[11px] text-dim">{Math.round(it.multiplier)}x</span>
                      {it.outcome && (
                        <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-dim">
                          {outcomeShort(it.outcome)}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={
                          "font-mono text-sm " +
                          (it.pnl >= 0 ? "text-long text-glow-long" : "text-short text-glow-short")
                        }
                      >
                        {it.pnl >= 0 ? "+" : ""}
                        {it.pnl.toFixed(2)}
                      </span>
                      {state === "tx" && (
                        <span className="font-mono text-[10px] text-ink/70" title="settled on-chain">
                          tx↗
                        </span>
                      )}
                      {state === "pending" && (
                        <span className="font-mono text-[9px] text-dim/60 animate-pulse" title="settling on chain…">
                          settling…
                        </span>
                      )}
                      {state === "stale" && (
                        <span className="font-mono text-[10px] text-dim/50" title="open wallet history">
                          ↗
                        </span>
                      )}
                    </div>
                  </Row>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
