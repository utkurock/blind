"use client";

export type StoredHistoryItem = {
  round: number;
  asset: string;
  side: "long" | "short";
  multiplier: number;
  win: boolean;
  pnl: number;
  ts: number;
  outcome?: "liq" | "small_loss" | "small_profit" | "tp";
  /** Filled in asynchronously when the on-chain settlement TX confirms. */
  txHash?: string;
};

const KEYS = {
  playSecret: "blind.stellar.play.secret",
  playPub: "blind.stellar.play.pub",
  bankSecret: "blind.stellar.bank.secret",
  bankPub: "blind.stellar.bank.pub",
  risk: "blind.game.risk",
  history: "blind.game.history",
  palette: "blind.palette",
  chartStyle: "blind.chartStyle",
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    if (v == null) return fallback;
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function clear(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

export const storage = {
  getPlay: () => {
    const pub = read<string | null>(KEYS.playPub, null);
    const secret = read<string | null>(KEYS.playSecret, null);
    return pub && secret ? { publicKey: pub, secret } : null;
  },
  setPlay: (w: { publicKey: string; secret: string }) => {
    write(KEYS.playPub, w.publicKey);
    write(KEYS.playSecret, w.secret);
  },

  getBank: () => {
    const pub = read<string | null>(KEYS.bankPub, null);
    const secret = read<string | null>(KEYS.bankSecret, null);
    return pub && secret ? { publicKey: pub, secret } : null;
  },
  setBank: (w: { publicKey: string; secret: string }) => {
    write(KEYS.bankPub, w.publicKey);
    write(KEYS.bankSecret, w.secret);
  },

  /** Risk value as integer 1..10 (each unit = 1% of balance) */
  getRisk: () => read<number>(KEYS.risk, 2),
  setRisk: (n: number) => write(KEYS.risk, n),

  getHistory: () => read<StoredHistoryItem[]>(KEYS.history, []),
  setHistory: (h: StoredHistoryItem[]) => write(KEYS.history, h),

  getPaletteId: (): string | null => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(KEYS.palette);
    } catch {
      return null;
    }
  },
  setPaletteId: (id: string) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(KEYS.palette, id);
    } catch {}
  },

  getChartStyleId: (): string | null => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(KEYS.chartStyle);
    } catch {
      return null;
    }
  },
  setChartStyleId: (id: string) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(KEYS.chartStyle, id);
    } catch {}
  },

  wipe: () => {
    clear(KEYS.playPub);
    clear(KEYS.playSecret);
    clear(KEYS.bankPub);
    clear(KEYS.bankSecret);
    clear(KEYS.history);
  },
};
