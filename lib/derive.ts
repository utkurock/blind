export const ASSETS = [
  "BTC", "ETH", "SOL", "XLM", "DOGE", "PEPE", "HYPE",
] as const;

export type Asset = (typeof ASSETS)[number];

/** Binance USDT spot symbol for each asset. Used by lib/binance fetch. */
export const ASSET_SYMBOL: Record<Asset, string> = {
  BTC:  "BTCUSDT",
  ETH:  "ETHUSDT",
  SOL:  "SOLUSDT",
  XLM:  "XLMUSDT",
  DOGE: "DOGEUSDT",
  PEPE: "PEPEUSDT",
  HYPE: "HYPEUSDT",
};

export type Side = "long" | "short";

export type Candle = { time: number; open: number; high: number; low: number; close: number };

export type OutcomeKind = "liq" | "small_loss" | "small_profit" | "tp";

export type DerivedRound = {
  asset: Asset;
  side: Side;
  /** Leverage, integer in [100, 500] */
  multiplier: number;
  outcomeKind: OutcomeKind;
  /** Signed factor on stake; pnl = stake * outcomePctOfStake. */
  outcomePctOfStake: number;
  outcomeWin: boolean;
  candle: Candle;
};

export function outcomeLabel(k: OutcomeKind): string {
  switch (k) {
    case "liq":          return "liquidated";
    case "small_loss":   return "small loss";
    case "small_profit": return "small win";
    case "tp":           return "take-profit";
  }
}

export function outcomeShortLabel(k: OutcomeKind): string {
  switch (k) {
    case "liq":          return "liq";
    case "small_loss":   return "loss";
    case "small_profit": return "win";
    case "tp":           return "tp";
  }
}

function hexBytes(hex: string): number[] {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 2) out.push(parseInt(clean.slice(i, i + 2), 16));
  return out;
}

function u16(b: number[], i: number) {
  return ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
}
function u32(b: number[], i: number) {
  return (((b[i] ?? 0) << 24) | ((b[i + 1] ?? 0) << 16) | ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0)) >>> 0;
}

/** Outcome bucket weights — together near-fair EV with high-variance tails. */
const OUTCOME_BUCKETS: { kind: OutcomeKind; cumulative: number }[] = [
  { kind: "small_loss",   cumulative: 0.40 }, // 40%
  { kind: "small_profit", cumulative: 0.65 }, // 25%
  { kind: "tp",           cumulative: 0.75 }, // 10%
  { kind: "liq",          cumulative: 1.00 }, // 25%
];

function pickOutcome(b: number[]): { kind: OutcomeKind; pctOfStake: number } {
  const roll = (b[7] ?? 0) / 255;
  const mag = (b[8] ?? 0) / 255;
  let kind: OutcomeKind = "small_loss";
  for (const bucket of OUTCOME_BUCKETS) {
    if (roll <= bucket.cumulative) {
      kind = bucket.kind;
      break;
    }
  }
  let pct: number;
  switch (kind) {
    case "liq":          pct = -1; break;
    case "small_loss":   pct = -(0.05 + mag * 0.45); break;   // -5% .. -50% of stake
    case "small_profit": pct =  (0.05 + mag * 0.45); break;   // +5% .. +50% of stake
    case "tp":           pct =  (1.0 + mag * 4.0); break;     // +100% .. +500% of stake
  }
  return { kind, pctOfStake: pct };
}

export function deriveRound(args: {
  randomnessHex: string;
  prevClose: number;
  roundTimeSec: number;
}): DerivedRound {
  const { randomnessHex, prevClose, roundTimeSec } = args;
  const b = hexBytes(randomnessHex);

  const assetIdx = u32(b, 0) % ASSETS.length;
  const side: Side = (b[4] ?? 0) % 2 === 0 ? "long" : "short";

  // leverage 100..500x, integer
  const mRaw = u16(b, 5) / 0xffff;
  const multiplier = Math.round(100 + mRaw * 400);

  const { kind: outcomeKind, pctOfStake: outcomePctOfStake } = pickOutcome(b);
  const outcomeWin = outcomePctOfStake > 0;

  // synthetic candle for the initial drand-feed seed (real chart replaces it on first cycle)
  const deltaPct = (((b[9] ?? 0) - 128) / 128) * 0.04;
  const wiggleHi = ((b[10] ?? 0) / 0xff) * 0.02;
  const wiggleLo = ((b[11] ?? 0) / 0xff) * 0.02;
  const open = prevClose;
  const close = Math.max(0.01, prevClose * (1 + deltaPct));
  const high = Math.max(open, close) * (1 + wiggleHi);
  const low = Math.min(open, close) * (1 - wiggleLo);

  return {
    asset: ASSETS[assetIdx],
    side,
    multiplier,
    outcomeKind,
    outcomePctOfStake,
    outcomeWin,
    candle: { time: roundTimeSec, open, high, low, close },
  };
}

export function settlePnl(stake: number, pctOfStake: number): number {
  return stake * pctOfStake;
}
