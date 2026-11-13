"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usSessionAt, type UsSession } from "./ta";
import type { LiveQuote } from "./types";

/** Polls /api/live for the given symbols while the tab is visible. */
export function useLiveQuotes(symbols: string[], intervalMs = 5000, enabled = true) {
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [source, setSource] = useState<"live" | "demo" | null>(null);
  const [lastAt, setLastAt] = useState<number | null>(null);
  const key = useMemo(() => [...new Set(symbols)].sort().join(","), [symbols]);

  useEffect(() => {
    if (!enabled || !key) return;
    let stop = false;
    let ctrl: AbortController | null = null;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      ctrl?.abort();
      ctrl = new AbortController();
      try {
        const res = await fetch(`/api/live?symbols=${encodeURIComponent(key)}`, { cache: "no-store", signal: ctrl.signal });
        if (!res.ok || stop) return;
        const json = (await res.json()) as { source: "live" | "demo"; quotes: LiveQuote[] };
        if (stop) return;
        setQuotes((prev) => {
          const next = { ...prev };
          json.quotes.forEach((q) => (next[q.symbol] = q));
          return next;
        });
        setSource(json.source);
        setLastAt(Date.now());
      } catch {
        /* network hiccup — next tick retries */
      }
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, intervalMs);
    const onVis = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      ctrl?.abort();
      clearTimeout(first);
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [key, intervalMs, enabled]);

  return { quotes, source, lastAt };
}

const STREAMS: Record<string, string> = {
  BTCUSDT: "BTC-USD",
  ETHUSDT: "ETH-USD",
  SOLUSDT: "SOL-USD",
};
const WS_URLS = [
  "wss://stream.binance.com:9443/stream?streams=",
  "wss://data-stream.binance.vision/stream?streams=",
];

/** Tick-by-tick crypto prices from Binance public WebSocket (no key). Flushes to React once per second. */
export function useCryptoStream(enabled = true) {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [connected, setConnected] = useState(false);
  const buffer = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!enabled) return;
    let ws: WebSocket | null = null;
    let closed = false;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const streams = Object.keys(STREAMS).map((s) => `${s.toLowerCase()}@miniTicker`).join("/");

    const connect = () => {
      const url = WS_URLS[attempt % WS_URLS.length] + streams;
      try {
        ws = new WebSocket(url);
      } catch {
        schedule();
        return;
      }
      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as { data?: { s: string; c: string } };
          const d = msg.data;
          if (d && STREAMS[d.s]) buffer.current[STREAMS[d.s]] = Number(d.c);
        } catch {
          /* ignore malformed frame */
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closed) schedule();
      };
      ws.onerror = () => ws?.close();
    };
    const schedule = () => {
      attempt++;
      retry = setTimeout(connect, Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5)));
    };
    connect();

    const flush = setInterval(() => {
      if (Object.keys(buffer.current).length) {
        const b = buffer.current;
        buffer.current = {};
        setPrices((p) => ({ ...p, ...b }));
      }
    }, 1000);

    return () => {
      closed = true;
      clearTimeout(retry);
      clearInterval(flush);
      ws?.close();
    };
  }, [enabled]);

  return { prices, connected };
}

export type { UsSession } from "./ta";
export const usSession = (d = new Date()) => usSessionAt(Math.floor(d.getTime() / 1000));

export function useUsSession(): UsSession | null {
  const [s, setS] = useState<UsSession | null>(null);
  useEffect(() => {
    const upd = () => setS(usSession());
    const first = setTimeout(upd, 0);
    const id = setInterval(upd, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  return s;
}

/** Watchlist persisted in localStorage. */
const WL_KEY = "neon-pulse:watchlist";
export const DEFAULT_WATCHLIST = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AVGO"];

export function useWatchlist() {
  const [list, setList] = useState<string[]>(DEFAULT_WATCHLIST);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = localStorage.getItem(WL_KEY);
        if (raw) setList(JSON.parse(raw));
      } catch {
        /* storage unavailable */
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const save = (next: string[]) => {
    setList(next);
    try {
      localStorage.setItem(WL_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  return {
    list,
    has: (s: string) => list.includes(s),
    toggle: (s: string) => save(list.includes(s) ? list.filter((x) => x !== s) : [...list, s]),
  };
}
