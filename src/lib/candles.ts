"use client";

import { useEffect, useState } from "react";
import { isIntraday } from "./ta";
import type { Candle, CandlesPayload, Timeframe } from "./types";

const BINANCE_TF: Record<Timeframe, string> = { "1m": "1m", "5m": "5m", "15m": "15m", "1h": "1h", "1d": "1d", "1wk": "1w" };
const BINANCE_REST = ["https://api.binance.com", "https://data-api.binance.vision"];
const BINANCE_WS = ["wss://stream.binance.com:9443/ws/", "wss://data-stream.binance.vision/ws/"];
const STABLE_PAIRS = new Set(["USDT-USD", "USDC-USD"]);

/** Yahoo crypto symbol → Binance USDT pair (BTC-USD → BTCUSDT). */
export function binancePair(symbol: string): string | null {
  if (!/^[A-Z0-9]{2,10}-USD$/.test(symbol) || STABLE_PAIRS.has(symbol)) return null;
  return symbol.replace("-USD", "USDT");
}

type Row = [number, string, string, string, string, string];

async function binanceKlines(pair: string, tf: Timeframe): Promise<Candle[]> {
  let lastErr: unknown;
  for (const base of BINANCE_REST) {
    try {
      const r = await fetch(`${base}/api/v3/klines?symbol=${pair}&interval=${BINANCE_TF[tf]}&limit=1000`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const rows = (await r.json()) as Row[];
      return rows.map((k) => ({ t: k[0] / 1000, o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/** Replace the overlapping tail of `base` with fresher bars. */
export function mergeCandles(base: Candle[], fresh: Candle[]): Candle[] {
  if (!fresh.length) return base;
  const from = fresh[0].t;
  let i = base.length;
  while (i > 0 && base[i - 1].t >= from) i--;
  return base.slice(0, i).concat(fresh);
}

export interface CandleState {
  candles: Candle[];
  source: CandlesPayload["source"] | null;
  name?: string;
  loading: boolean;
  error: string | null;
  live: boolean; // streaming (crypto WS) or polling active
}

/**
 * OHLCV candles for any symbol + timeframe, kept live:
 * crypto → Binance REST history + kline WebSocket (tick-by-tick);
 * everything else → /api/candles history + polling of the recent window.
 */
export function useCandles(symbol: string, tf: Timeframe, enabled = true): CandleState {
  const [state, setState] = useState<CandleState>({ candles: [], source: null, loading: true, error: null, live: false });

  useEffect(() => {
    if (!enabled || !symbol) return;
    let alive = true;
    let ws: WebSocket | null = null;
    let poll: ReturnType<typeof setInterval> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const set = (f: (s: CandleState) => CandleState) => alive && setState(f);
    const reset = setTimeout(() => set(() => ({ candles: [], source: null, loading: true, error: null, live: false })), 0);

    const viaServer = async () => {
      const r = await fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&tf=${tf}`);
      const j = (await r.json()) as CandlesPayload & { error?: string };
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      set(() => ({ candles: j.candles, source: j.source, name: j.name, loading: false, error: null, live: true }));
      const every = isIntraday(tf) ? (tf === "1m" ? 3000 : 5000) : 15000;
      poll = setInterval(async () => {
        if (document.visibilityState !== "visible") return;
        try {
          const rr = await fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&tf=${tf}&live=1`, { cache: "no-store" });
          if (!rr.ok) return;
          const jj = (await rr.json()) as CandlesPayload;
          set((s) => ({ ...s, candles: mergeCandles(s.candles, jj.candles) }));
        } catch {
          /* keep last data */
        }
      }, every);
    };

    const viaBinance = async (pair: string) => {
      const candles = await binanceKlines(pair, tf);
      set(() => ({ candles, source: "binance", loading: false, error: null, live: false }));
      let attempt = 0;
      const connect = () => {
        ws = new WebSocket(`${BINANCE_WS[attempt % BINANCE_WS.length]}${pair.toLowerCase()}@kline_${BINANCE_TF[tf]}`);
        ws.onopen = () => {
          attempt = 0;
          set((s) => ({ ...s, live: true }));
        };
        ws.onmessage = (ev) => {
          try {
            const k = (JSON.parse(ev.data as string) as { k: { t: number; o: string; h: string; l: string; c: string; v: string } }).k;
            const bar: Candle = { t: k.t / 1000, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v };
            set((s) => ({ ...s, candles: mergeCandles(s.candles, [bar]) }));
          } catch {
            /* ignore */
          }
        };
        ws.onclose = () => {
          set((s) => ({ ...s, live: false }));
          if (alive) retry = setTimeout(connect, Math.min(30_000, 1000 * 2 ** Math.min(++attempt, 5)));
        };
        ws.onerror = () => ws?.close();
      };
      connect();
    };

    (async () => {
      const pair = binancePair(symbol);
      try {
        if (pair) await viaBinance(pair);
        else await viaServer();
      } catch (e) {
        if (pair) {
          try {
            await viaServer(); // Binance blocked — fall back to Yahoo via our API
            return;
          } catch (e2) {
            e = e2;
          }
        }
        set((s) => ({ ...s, loading: false, error: (e as Error).message }));
      }
    })();

    return () => {
      alive = false;
      clearTimeout(reset);
      clearInterval(poll);
      clearTimeout(retry);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [symbol, tf, enabled]);

  return state;
}
