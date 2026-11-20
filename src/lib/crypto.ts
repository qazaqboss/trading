"use client";

import { useEffect, useRef, useState } from "react";

/* ───────────── types (CoinGecko shapes we use) ───────────── */

export interface CgCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number | null;
  market_cap: number | null;
  market_cap_rank: number | null;
  fully_diluted_valuation: number | null;
  total_volume: number | null;
  high_24h: number | null;
  low_24h: number | null;
  circulating_supply: number | null;
  total_supply: number | null;
  max_supply: number | null;
  ath: number | null;
  ath_change_percentage: number | null;
  price_change_percentage_1h_in_currency?: number | null;
  price_change_percentage_24h_in_currency?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  sparkline_in_7d?: { price: number[] };
}

export interface CgGlobal {
  active_cryptocurrencies: number;
  markets: number;
  total_market_cap: Record<string, number>;
  total_volume: Record<string, number>;
  market_cap_percentage: Record<string, number>;
  market_cap_change_percentage_24h_usd: number;
}

export interface CgTrending {
  coins: { item: { id: string; name: string; symbol: string; thumb: string; market_cap_rank: number | null; data?: { price?: number; price_change_percentage_24h?: Record<string, number> } } }[];
}

export interface CgSearch {
  coins: { id: string; name: string; symbol: string; thumb: string; market_cap_rank: number | null }[];
}

export interface CgCoinDetail {
  id: string;
  symbol: string;
  name: string;
  categories: string[];
  description: { en?: string };
  links: { homepage: string[]; blockchain_site: string[]; twitter_screen_name?: string; subreddit_url?: string; repos_url?: { github?: string[] } };
  image: { large: string; small: string };
  genesis_date: string | null;
  platforms: Record<string, string>;
  market_cap_rank: number | null;
  market_data: {
    current_price: Record<string, number>;
    ath: Record<string, number>;
    ath_change_percentage: Record<string, number>;
    ath_date: Record<string, string>;
    atl: Record<string, number>;
    atl_change_percentage: Record<string, number>;
    atl_date: Record<string, string>;
    market_cap: Record<string, number>;
    fully_diluted_valuation: Record<string, number>;
    total_volume: Record<string, number>;
    high_24h: Record<string, number>;
    low_24h: Record<string, number>;
    price_change_percentage_1h_in_currency?: Record<string, number>;
    price_change_percentage_24h: number;
    price_change_percentage_7d: number;
    price_change_percentage_14d: number;
    price_change_percentage_30d: number;
    price_change_percentage_1y: number;
    circulating_supply: number | null;
    total_supply: number | null;
    max_supply: number | null;
  };
}

/* ───────────── fetcher: browser → CoinGecko, else our proxy ───────────── */

const CG = "https://api.coingecko.com/api/v3/";
let directBlockedUntil = 0;

/** `ep` is the CoinGecko endpoint path (e.g. "coins/markets"); params are passed through. */
export async function cg<T>(ep: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  if (Date.now() > directBlockedUntil) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(`${CG}${ep}${qs ? `?${qs}` : ""}`, { signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok) return (await r.json()) as T;
      if (r.status === 429) directBlockedUntil = Date.now() + 60_000; // rate limited: use the server cache for a minute
    } catch {
      directBlockedUntil = Date.now() + 60_000;
    }
  }
  const r = await fetch(`/api/crypto?ep=${encodeURIComponent(ep)}${qs ? `&${qs}` : ""}`);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
  return j as T;
}

export const CATEGORIES: { id: string; label: string }[] = [
  { id: "", label: "Все монеты" },
  { id: "meme-token", label: "🐸 Мем-коины" },
  { id: "solana-meme-coins", label: "Мемы Solana" },
  { id: "layer-1", label: "Layer 1" },
  { id: "decentralized-finance-defi", label: "DeFi" },
  { id: "artificial-intelligence", label: "ИИ" },
  { id: "gaming", label: "GameFi" },
  { id: "stablecoins", label: "Стейблкоины" },
];

/* ───────────── Binance: every USDT pair, live ───────────── */

export interface LiveTick {
  c: number; // last
  o: number; // open 24h ago
}

const ALL_WS = ["wss://stream.binance.com:9443/ws/!miniTicker@arr", "wss://data-stream.binance.vision/ws/!miniTicker@arr"];

/** Live last price + 24h open for all Binance USDT pairs keyed by base symbol (BTC, PEPE…). Flushes once per second. */
export function useBinanceAll(enabled = true) {
  const [ticks, setTicks] = useState<Record<string, LiveTick>>({});
  const [connected, setConnected] = useState(false);
  const buf = useRef<Record<string, LiveTick>>({});

  useEffect(() => {
    if (!enabled) return;
    let ws: WebSocket | null = null;
    let alive = true;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      ws = new WebSocket(ALL_WS[attempt % ALL_WS.length]);
      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
      };
      ws.onmessage = (ev) => {
        try {
          const arr = JSON.parse(ev.data as string) as { s: string; c: string; o: string }[];
          for (const t of arr) if (t.s.endsWith("USDT")) buf.current[t.s.slice(0, -4)] = { c: +t.c, o: +t.o };
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (alive) retry = setTimeout(connect, Math.min(30_000, 1000 * 2 ** Math.min(++attempt, 5)));
      };
      ws.onerror = () => ws?.close();
    };
    connect();
    const flush = setInterval(() => {
      if (!Object.keys(buf.current).length) return;
      const b = buf.current;
      buf.current = {};
      setTicks((p) => ({ ...p, ...b }));
    }, 1000);
    return () => {
      alive = false;
      clearTimeout(retry);
      clearInterval(flush);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [enabled]);

  return { ticks, connected };
}

/**
 * Binance symbols can collide with unrelated small coins (many tokens are called "ELON" or "AI").
 * Only trust the live tick when the coin is reasonably ranked and the prices agree within 5%.
 */
export function liveFor(coin: Pick<CgCoin, "symbol" | "current_price" | "market_cap_rank">, ticks: Record<string, LiveTick>): LiveTick | null {
  const t = ticks[coin.symbol.toUpperCase()];
  if (!t || !coin.current_price) return null;
  if ((coin.market_cap_rank ?? 99999) > 1500) return null;
  return Math.abs(t.c / coin.current_price - 1) < 0.05 ? t : null;
}

/* ───────────── crypto watchlist ───────────── */

const WL = "neon-pulse:crypto-watch";
export function useCryptoWatch() {
  const [ids, setIds] = useState<string[]>(["bitcoin", "ethereum", "solana", "dogecoin", "pepe"]);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = localStorage.getItem(WL);
        if (raw) setIds(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const toggle = (id: string) =>
    setIds((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      try {
        localStorage.setItem(WL, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  return { ids, has: (id: string) => ids.includes(id), toggle };
}
