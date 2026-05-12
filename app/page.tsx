"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chart, type ChartHandle, type CandleInput } from "@/components/chart";
import { HeaderBar } from "@/components/header-bar";
import { RevealCard, type CyclePhase } from "@/components/reveal-card";
import { HistoryList } from "@/components/history-list";
import { WalletModal } from "@/components/wallet-modal";
import { SpinModal } from "@/components/spin-modal";
import { fetchFeed, useDrandRound, type DrandRound } from "@/lib/drand";
import {
  deriveRound,
  settlePnl,
  ASSETS,
  ASSET_SYMBOL,
  type Asset,
  type DerivedRound,
} from "@/lib/derive";
import {
  createKeypair,
  fundWithFriendbot,
  getXlmBalance,
  submitPayment,
  drainTo,
  RESERVE_BUFFER,
  type Wallet,
} from "@/lib/stellar";
import { fetchKlines } from "@/lib/binance";
import { storage, type StoredHistoryItem } from "@/lib/storage";
import {
  paletteById,
  chartStyleById,
  type Palette,
  type PaletteId,
  type ChartStyle,
  type ChartStyleId,
} from "@/lib/palettes";

const INITIAL_PRICE = 100;
const HISTORY_LIMIT = 30;

const PHASE = {
  assetSpinMs:    900,
  sideSpinMs:     500,
  multSpinMs:     3500,
  interStepMs:    2000,  // breath between each reveal step
  openHoldMs:     2000,  // trade visible after leverage locks
  pnlSuspenseMs:  3500,  // wait before revealing pnl (non-liq only)
  settleHoldMs:   1500,  // hold after pnl is revealed
  cooldownMs:     2000,
} as const;

type OpenTrade = DerivedRound & { stake: number; round: number };
type SettledTrade = OpenTrade & { pnl: number };

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export default function Page() {
  const [hydrated, setHydrated] = useState(false);
  const [play, setPlay] = useState<Wallet | null>(null);
  const [bank, setBank] = useState<Wallet | null>(null);
  const [balance, setBalance] = useState(0);
  const [bankBalance, setBankBalance] = useState(0);
  const [risk, setRisk] = useState(2);
  const [riskLocked, setRiskLocked] = useState(true);
  const stakePct = risk / 100;
  const [playing, setPlaying] = useState(false);
  const [history, setHistory] = useState<StoredHistoryItem[]>([]);
  const [lastSettled, setLastSettled] = useState<SettledTrade | null>(null);
  const [pnlVisible, setPnlVisible] = useState(true);
  const [drandRound, setDrandRound] = useState<number | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [spinOpen, setSpinOpen] = useState(false);
  const [seedKey, setSeedKey] = useState(0);
  const [paletteId, setPaletteIdState] = useState<PaletteId>("noir");
  const [chartStyle, setChartStyleState] = useState<ChartStyleId>("candle");

  // Cycle state — drives the sequential reveal animation
  const [cyclePhase, setCyclePhase] = useState<CyclePhase>("idle");
  const [revealAsset, setRevealAsset] = useState<string | null>(null);
  const [revealSide, setRevealSide] = useState<"long" | "short" | null>(null);
  const [revealMult, setRevealMult] = useState<number | null>(null);
  const [currentRound, setCurrentRound] = useState<number | null>(null);

  const chartRef = useRef<ChartHandle>(null);
  const playingRef = useRef(playing);
  const balanceRef = useRef(balance);
  const bankBalanceRef = useRef(bankBalance);
  const stakeRef = useRef(stakePct);
  const playRef = useRef<Wallet | null>(null);
  const bankRef = useRef<Wallet | null>(null);
  const cycleRunningRef = useRef(false);
  const bufferedRoundRef = useRef<DrandRound | null>(null);

  playingRef.current = playing;
  balanceRef.current = balance;
  bankBalanceRef.current = bankBalance;
  stakeRef.current = stakePct;
  playRef.current = play;
  bankRef.current = bank;

  // when user pauses while idle, drop the trailing settled card so the panel resets
  useEffect(() => {
    if (!playing && !cycleRunningRef.current) setLastSettled(null);
  }, [playing]);

  // Hydrate from localStorage
  useEffect(() => {
    setPlay(storage.getPlay());
    setBank(storage.getBank());
    const r = storage.getRisk();
    setRisk(Math.min(10, Math.max(1, Math.round(r))));
    setHistory(storage.getHistory());
    setPaletteIdState(paletteById(storage.getPaletteId()).id);
    setChartStyleState(chartStyleById(storage.getChartStyleId()).id);
    setHydrated(true);
  }, []);

  const applySpin = useCallback((p: Palette, s: ChartStyle) => {
    setPaletteIdState(p.id);
    storage.setPaletteId(p.id);
    setChartStyleState(s.id);
    storage.setChartStyleId(s.id);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.palette = p.id;
    }
  }, []);

  // Initial chart seed from drand /feed so it isn't empty before the first trade
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    (async () => {
      const feed = await fetchFeed();
      if (cancelled || feed.length === 0) return;
      const sorted = [...feed].sort((a, b) => a.round - b.round);
      const baseTime = Math.floor(Date.now() / 1000) - sorted.length * 3;
      let close = INITIAL_PRICE;
      const candles: CandleInput[] = sorted.map((r, i) => {
        const d = deriveRound({
          randomnessHex: r.randomness,
          prevClose: close,
          roundTimeSec: baseTime + i * 3,
        });
        close = d.candle.close;
        return d.candle;
      });
      chartRef.current?.setSeed(candles);
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, seedKey]);

  // Persist
  useEffect(() => { if (hydrated && riskLocked) storage.setRisk(risk); }, [risk, riskLocked, hydrated]);
  useEffect(() => { if (hydrated) storage.setHistory(history); }, [history, hydrated]);

  // Poll on-chain balance
  useEffect(() => {
    if (!play) return;
    let cancelled = false;
    const refresh = async () => {
      const [pb, bb] = await Promise.all([
        getXlmBalance(play.publicKey),
        bank ? getXlmBalance(bank.publicKey) : Promise.resolve(0),
      ]);
      if (!cancelled) {
        setBalance(pb);
        setBankBalance(bb);
      }
    };
    refresh();
    const t = setInterval(refresh, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [play, bank]);

  // ---- cycle helpers ----

  const spinDecelerating = useCallback(
    <T,>(
      setter: (v: T) => void,
      pool: readonly T[],
      target: T,
      totalMs: number,
    ): Promise<void> => {
      return new Promise((resolve) => {
        const start = performance.now();
        let i = 0;
        const tick = () => {
          const elapsed = performance.now() - start;
          const progress = Math.min(1, elapsed / totalMs);
          if (progress >= 1) {
            setter(target);
            resolve();
            return;
          }
          i = (i + 1) % pool.length;
          setter(pool[i]);
          const interval = 50 + progress * progress * 220;
          setTimeout(tick, interval);
        };
        tick();
      });
    },
    [],
  );

  const spinMultiplier = useCallback(
    (target: number, totalMs: number): Promise<void> => {
      return new Promise((resolve) => {
        const start = performance.now();
        const tick = () => {
          const elapsed = performance.now() - start;
          const progress = Math.min(1, elapsed / totalMs);
          if (progress >= 1) {
            setRevealMult(Math.round(target));
            resolve();
            return;
          }
          // noisy integer leverage in [100, 500], blended toward target only at the very end
          const noisy = 100 + Math.floor(Math.random() * 401);
          const blendWeight = progress < 0.85 ? 0 : (progress - 0.85) / 0.15;
          const blended = Math.round(noisy * (1 - blendWeight) + target * blendWeight);
          setRevealMult(blended);
          // fast throughout, mild ease-out at the tail so it visibly snaps onto a number
          const interval = 32 + progress * progress * 70;
          setTimeout(tick, interval);
        };
        tick();
      });
    },
    [],
  );

  const loadRealChart = useCallback(async (asset: Asset) => {
    const symbol = ASSET_SYMBOL[asset];
    if (!symbol) return;
    const klines = await fetchKlines(symbol, 100);
    if (klines.length === 0) return; // fallback: keep existing chart
    chartRef.current?.setSeed(klines);
  }, []);

  const setHistoryHash = useCallback((round: number, hash: string) => {
    setHistory((h) => h.map((it) => (it.round === round ? { ...it, txHash: hash } : it)));
  }, []);

  const fireSettlementTx = useCallback(
    (trade: OpenTrade, pnl: number) => {
      const p = playRef.current;
      const b = bankRef.current;
      if (!p || !b) return;
      const memo = `BLIND R${trade.round % 1_000_000} ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}`;
      const attach = (promise: Promise<{ ok: boolean; hash?: string; error?: string }>) => {
        promise
          .then((result) => {
            if (result.ok && result.hash) setHistoryHash(trade.round, result.hash);
          })
          .catch(() => undefined);
      };
      if (trade.outcomeWin && pnl > 0) {
        attach(
          submitPayment({
            sourceSecret: b.secret,
            destination: p.publicKey,
            amount: pnl,
            memo,
          }),
        );
      } else if (!trade.outcomeWin && pnl < 0) {
        attach(
          submitPayment({
            sourceSecret: p.secret,
            destination: b.publicKey,
            amount: Math.abs(pnl),
            memo,
          }),
        );
      }
    },
    [setHistoryHash],
  );

  const runCycle = useCallback(
    async (r: DrandRound) => {
      if (cycleRunningRef.current) return;
      if (!playingRef.current) return;
      const p = playRef.current;
      const b = bankRef.current;
      if (!p || !b) return;

      const spendable = balanceRef.current - RESERVE_BUFFER;
      if (spendable <= 0) return;

      const derived = deriveRound({
        randomnessHex: r.randomness,
        prevClose: INITIAL_PRICE,
        roundTimeSec: Math.floor(Date.now() / 1000),
      });
      const stake = Math.min(spendable, balanceRef.current * stakeRef.current);
      const trade: OpenTrade = { ...derived, stake, round: r.round };

      cycleRunningRef.current = true;
      setDrandRound(r.round);
      setCurrentRound(r.round);
      setRevealAsset(null);
      setRevealSide(null);
      setRevealMult(null);
      setLastSettled(null);

      // ----- asset spin -----
      setCyclePhase("asset-spin");
      await spinDecelerating<string>(
        (v) => setRevealAsset(v),
        ASSETS as readonly string[],
        trade.asset,
        PHASE.assetSpinMs,
      );

      // asset locked → switch chart to that asset's real klines (fire-and-forget)
      loadRealChart(trade.asset);

      // ----- asset hold: 2s breath -----
      setCyclePhase("asset-hold");
      await sleep(PHASE.interStepMs);

      // ----- side spin -----
      setCyclePhase("side-spin");
      await spinDecelerating<"long" | "short">(
        (v) => setRevealSide(v),
        ["long", "short"] as const,
        trade.side,
        PHASE.sideSpinMs,
      );

      // ----- side hold: 2s breath -----
      setCyclePhase("side-hold");
      await sleep(PHASE.interStepMs);

      // ----- multiplier (leverage) spin -----
      setCyclePhase("mult-spin");
      await spinMultiplier(trade.multiplier, PHASE.multSpinMs);

      // ----- open hold: trade fully visible, suspense before outcome -----
      setCyclePhase("open");
      await sleep(PHASE.openHoldMs);

      // ----- settle (outcome bucket: liq / loss / win / tp) -----
      const pnl = settlePnl(trade.stake, trade.outcomePctOfStake);
      const item: StoredHistoryItem = {
        round: trade.round,
        asset: trade.asset,
        side: trade.side,
        multiplier: trade.multiplier,
        win: trade.outcomeWin,
        pnl,
        ts: Date.now(),
        outcome: trade.outcomeKind,
      };

      setCyclePhase("settled");

      if (trade.outcomeKind === "liq") {
        // liquidation lands instantly — no suspense needed
        setLastSettled({ ...trade, pnl });
        setPnlVisible(true);
        setHistory((h) => [item, ...h].slice(0, HISTORY_LIMIT));
        setBalance((bal) => Math.max(0, bal + pnl));
        setBankBalance((bal) => Math.max(0, bal - pnl));
        fireSettlementTx(trade, pnl);
        await sleep(PHASE.settleHoldMs);
      } else {
        // suspense: show asset/side/leverage but hide outcome+pnl for ~3.5s
        setLastSettled({ ...trade, pnl });
        setPnlVisible(false);
        await sleep(PHASE.pnlSuspenseMs);
        // reveal
        setPnlVisible(true);
        setHistory((h) => [item, ...h].slice(0, HISTORY_LIMIT));
        setBalance((bal) => Math.max(0, bal + pnl));
        setBankBalance((bal) => Math.max(0, bal - pnl));
        fireSettlementTx(trade, pnl);
        await sleep(PHASE.settleHoldMs);
      }

      // ----- cooldown -----
      setCyclePhase("cooldown");
      await sleep(PHASE.cooldownMs);

      // ----- back to idle, consume buffered round if any -----
      setCyclePhase("idle");
      setRevealAsset(null);
      setRevealSide(null);
      setRevealMult(null);
      setCurrentRound(null);
      cycleRunningRef.current = false;
      // if user paused during the cycle, drop the settled card so the panel returns to the resting copy
      if (!playingRef.current) setLastSettled(null);

      const buf = bufferedRoundRef.current;
      bufferedRoundRef.current = null;
      if (buf && playingRef.current) {
        // small breath before next cycle starts so the cooldown feels real
        setTimeout(() => runCycle(buf), 30);
      }
    },
    [spinDecelerating, spinMultiplier, loadRealChart, fireSettlementTx],
  );

  // drand poller fires on each new round
  const handleNewRound = useCallback(
    (r: DrandRound) => {
      setDrandRound(r.round);
      if (!playingRef.current) return;
      if (cycleRunningRef.current) {
        // most recent round wins
        bufferedRoundRef.current = r;
      } else {
        runCycle(r);
      }
    },
    [runCycle],
  );

  useDrandRound(handleNewRound);

  // when user resumes PLAY mid-buffer, kick a cycle if one is queued
  useEffect(() => {
    if (!playing) return;
    if (cycleRunningRef.current) return;
    const buf = bufferedRoundRef.current;
    if (buf) {
      bufferedRoundRef.current = null;
      runCycle(buf);
    }
  }, [playing, runCycle]);

  // ---- wallet actions ----

  const onCreateWallet = useCallback(async () => {
    const p = createKeypair();
    const b = createKeypair();
    storage.setPlay(p);
    storage.setBank(b);
    setPlay(p);
    setBank(b);
    await Promise.all([fundWithFriendbot(p.publicKey), fundWithFriendbot(b.publicKey)]);
    const [pb, bb] = await Promise.all([
      getXlmBalance(p.publicKey),
      getXlmBalance(b.publicKey),
    ]);
    setBalance(pb);
    setBankBalance(bb);
  }, []);

  const onWithdraw = useCallback(async (destination: string) => {
    const p = playRef.current;
    const b = bankRef.current;
    if (!p || !b) return;
    await Promise.all([drainTo(p.secret, destination), drainTo(b.secret, destination)]);
    const [pb, bb] = await Promise.all([
      getXlmBalance(p.publicKey),
      getXlmBalance(b.publicKey),
    ]);
    setBalance(pb);
    setBankBalance(bb);
    setWalletOpen(false);
  }, []);

  const onWipe = useCallback(() => {
    storage.wipe();
    setPlay(null);
    setBank(null);
    setBalance(0);
    setBankBalance(0);
    setHistory([]);
    setLastSettled(null);
    setPlaying(false);
    setWalletOpen(false);
    setCyclePhase("idle");
    setRevealAsset(null);
    setRevealSide(null);
    setRevealMult(null);
    setCurrentRound(null);
    cycleRunningRef.current = false;
    bufferedRoundRef.current = null;
    chartRef.current?.reset();
    setSeedKey((k) => k + 1);
  }, []);

  const hasWallet = !!play && !!bank;

  return (
    <main className="flex min-h-screen flex-col lg:h-screen">
      <HeaderBar
        balance={balance}
        risk={risk}
        riskLocked={riskLocked}
        onRiskChange={setRisk}
        onRiskToggleLock={() => setRiskLocked((l) => !l)}
        playing={playing}
        onTogglePlay={() => setPlaying((p) => !p)}
        hasWallet={hasWallet}
        onOpenWallet={() => setWalletOpen(true)}
        drandRound={drandRound}
        paletteLabel={paletteById(paletteId).label}
        onOpenSpin={() => setSpinOpen(true)}
      />

      <div className="grid flex-1 grid-cols-12 gap-3 px-3 pt-3 pb-8 sm:gap-4 sm:px-4 sm:pt-4 sm:pb-10 lg:overflow-hidden lg:pb-8">
        <section className="col-span-12 flex flex-col gap-3 sm:gap-4 lg:col-span-8">
          <div className="panel-soft h-[44vh] overflow-hidden rounded-lg sm:h-[50vh] lg:h-auto lg:min-h-0 lg:flex-1">
            <Chart ref={chartRef} paletteId={paletteId} chartStyle={chartStyle} />
          </div>
          <RevealCard
            phase={cyclePhase}
            round={currentRound}
            revealAsset={revealAsset}
            revealSide={revealSide}
            revealMult={revealMult}
            lastSettled={lastSettled}
            pnlVisible={pnlVisible}
          />
        </section>

        <aside className="col-span-12 h-[40vh] min-h-0 lg:col-span-4 lg:h-auto">
          <HistoryList items={history} playPublicKey={play?.publicKey ?? null} />
        </aside>
      </div>

      <footer className="border-t border-line/60 px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-5">
        <div className="flex flex-col items-start justify-between gap-1 font-mono text-[10px] lowercase tracking-[0.2em] text-dim sm:flex-row sm:items-center sm:gap-0">
          <span>
            powered by{" "}
            <a
              href="https://github.com/kaankacar/Drand-Relay"
              target="_blank"
              rel="noreferrer"
              className="text-ink hover:opacity-70"
            >
              drand-relay
            </a>{" "}
            on stellar testnet
          </span>
          <span>
            created by{" "}
            <a
              href="https://x.com/utkurocks"
              target="_blank"
              rel="noreferrer"
              className="text-ink hover:opacity-70"
            >
              @utkurocks
            </a>
          </span>
        </div>
      </footer>

      <WalletModal
        open={walletOpen}
        onClose={() => setWalletOpen(false)}
        play={play}
        bank={bank}
        playBalance={balance}
        bankBalance={bankBalance}
        onCreate={onCreateWallet}
        onWithdraw={onWithdraw}
        onWipe={onWipe}
      />

      <SpinModal
        open={spinOpen}
        currentPalette={paletteId}
        currentChartStyle={chartStyle}
        onClose={() => setSpinOpen(false)}
        onApply={applySpin}
      />
    </main>
  );
}
