"use client";

import { useEffect, useRef, useState } from "react";

export const DRAND_URL = "https://stellardrand.duckdns.org/random";
export const DRAND_FEED_URL = "https://stellardrand.duckdns.org/feed";

export type DrandRound = {
  round: number;
  randomness: string;
  fetchedAt: number;
};

export async function fetchOnce(signal?: AbortSignal): Promise<DrandRound | null> {
  try {
    const res = await fetch(DRAND_URL, { signal, cache: "no-store" });
    if (!res.ok) return null;
    const json: any = await res.json();
    const round = Number(json.round ?? json.Round);
    const randomness: string = String(json.randomness ?? json.Randomness ?? "");
    if (!round || !randomness) return null;
    return { round, randomness, fetchedAt: Date.now() };
  } catch {
    return null;
  }
}

export async function fetchFeed(): Promise<DrandRound[]> {
  try {
    const res = await fetch(DRAND_FEED_URL, { cache: "no-store" });
    if (!res.ok) return [];
    const json: any = await res.json();
    const arr: any[] = Array.isArray(json) ? json : json.feed ?? json.rounds ?? [];
    return arr
      .map((r: any) => ({
        round: Number(r.round ?? r.Round),
        randomness: String(r.randomness ?? r.Randomness ?? ""),
        fetchedAt: Date.now(),
      }))
      .filter((r) => r.round > 0 && r.randomness.length > 0);
  } catch {
    return [];
  }
}

/**
 * Polls the drand relay every 3s. Fires onNewRound whenever the round number changes.
 * Returns the latest round seen.
 */
export function useDrandRound(onNewRound?: (r: DrandRound) => void) {
  const [latest, setLatest] = useState<DrandRound | null>(null);
  const lastRoundRef = useRef<number>(0);
  const cbRef = useRef(onNewRound);
  cbRef.current = onNewRound;

  useEffect(() => {
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const tick = async () => {
      const r = await fetchOnce(ctrl.signal);
      if (cancelled || !r) return;
      setLatest(r);
      if (r.round !== lastRoundRef.current) {
        lastRoundRef.current = r.round;
        cbRef.current?.(r);
      }
    };

    tick();
    timer = setInterval(tick, 3000);

    return () => {
      cancelled = true;
      ctrl.abort();
      if (timer) clearInterval(timer);
    };
  }, []);

  return latest;
}
