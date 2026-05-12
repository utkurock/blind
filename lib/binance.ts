"use client";

export type Kline = {
  time: number; // unix seconds (kline open time)
  open: number;
  high: number;
  low: number;
  close: number;
};

const BINANCE = "https://api.binance.com/api/v3/klines";
const OKX = "https://www.okx.com/api/v5/market/candles";

/**
 * Fetches the last N 1-minute klines for an asset.
 * Tries Binance USDT spot first; falls back to OKX for symbols Binance doesn't list (e.g. HYPE).
 * Returns [] on total failure so callers can gracefully degrade.
 */
export async function fetchKlines(symbol: string, limit = 100): Promise<Kline[]> {
  const fromBinance = await tryBinance(symbol, limit);
  if (fromBinance.length > 0) return fromBinance;
  // Binance symbol uses no dash (BTCUSDT); OKX uses dash (BTC-USDT).
  // Convert by inserting a dash before "USDT" suffix.
  const okxId = symbol.replace(/USDT$/, "-USDT");
  return tryOkx(okxId, limit);
}

async function tryBinance(symbol: string, limit: number): Promise<Kline[]> {
  try {
    const url = `${BINANCE}?symbol=${encodeURIComponent(symbol)}&interval=1m&limit=${limit}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const arr: unknown = await res.json();
    if (!Array.isArray(arr)) return [];
    return arr.map((k: any) => ({
      time: Math.floor(Number(k[0]) / 1000),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
    }));
  } catch {
    return [];
  }
}

async function tryOkx(instId: string, limit: number): Promise<Kline[]> {
  try {
    const url = `${OKX}?instId=${encodeURIComponent(instId)}&bar=1m&limit=${limit}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const json: any = await res.json();
    const data: any[] = Array.isArray(json?.data) ? json.data : [];
    // OKX returns newest-first; reverse so caller can sort ascending downstream.
    return data
      .map((k: any[]) => ({
        time: Math.floor(Number(k[0]) / 1000),
        open: Number(k[1]),
        high: Number(k[2]),
        low: Number(k[3]),
        close: Number(k[4]),
      }))
      .reverse();
  } catch {
    return [];
  }
}
