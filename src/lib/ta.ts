import type { Candle, Timeframe } from "./types";

export const TF_SECONDS: Record<Timeframe, number> = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "1d": 86400, "1wk": 604800 };
export const TF_LABEL: Record<Timeframe, string> = { "1m": "1м", "5m": "5м", "15m": "15м", "1h": "1ч", "1d": "1Д", "1wk": "1Н" };
export const isIntraday = (tf: Timeframe) => TF_SECONDS[tf] < 86400;

/* ───────────── New York clock ───────────── */

const nyFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "numeric",
  minute: "numeric",
  hour12: false,
});

export function nyClock(tSec: number): { date: string; mins: number; weekday: string } {
  const p: Record<string, string> = {};
  for (const x of nyFmt.formatToParts(new Date(tSec * 1000))) p[x.type] = x.value;
  return { date: `${p.year}-${p.month}-${p.day}`, mins: (Number(p.hour) % 24) * 60 + Number(p.minute), weekday: p.weekday };
}

export type UsSession = "pre" | "open" | "post" | "closed";

/** US equity session by New York clock (weekends closed; exchange holidays are not modelled). */
export function usSessionAt(tSec: number): UsSession {
  const { mins, weekday } = nyClock(tSec);
  if (weekday === "Sat" || weekday === "Sun") return "closed";
  if (mins >= 240 && mins < 570) return "pre";
  if (mins >= 570 && mins < 960) return "open";
  if (mins >= 960 && mins < 1200) return "post";
  return "closed";
}

/** US-listed instruments follow NYSE hours; crypto, futures and FX are treated as 24h with UTC days. */
export const followsUsHours = (symbol: string) => !/-USD$|=F$|=X$|^DX-Y/.test(symbol);

export function sessionDay(symbol: string, t: number): string {
  return followsUsHours(symbol) ? nyClock(t).date : new Date(t * 1000).toISOString().slice(0, 10);
}

/* ───────────── Indicator series ───────────── */

export function emaSeries(xs: number[], n: number): number[] {
  const out = new Array<number>(xs.length).fill(NaN);
  const k = 2 / (n + 1);
  let e = NaN;
  for (let i = 0; i < xs.length; i++) {
    if (i === n - 1) {
      let s = 0;
      for (let j = 0; j < n; j++) s += xs[j];
      e = s / n;
    } else if (i >= n) e = xs[i] * k + e * (1 - k);
    out[i] = i >= n - 1 ? e : NaN;
  }
  return out;
}

export function smaSeriesN(xs: number[], n: number): number[] {
  const out = new Array<number>(xs.length).fill(NaN);
  let s = 0;
  for (let i = 0; i < xs.length; i++) {
    s += xs[i];
    if (i >= n) s -= xs[i - n];
    if (i >= n - 1) out[i] = s / n;
  }
  return out;
}

export function rsiSeries(xs: number[], n = 14): number[] {
  const out = new Array<number>(xs.length).fill(NaN);
  if (xs.length <= n) return out;
  let g = 0;
  let l = 0;
  for (let i = 1; i <= n; i++) {
    const d = xs[i] - xs[i - 1];
    if (d > 0) g += d;
    else l -= d;
  }
  g /= n;
  l /= n;
  out[n] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  for (let i = n + 1; i < xs.length; i++) {
    const d = xs[i] - xs[i - 1];
    g = (g * (n - 1) + Math.max(d, 0)) / n;
    l = (l * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  return out;
}

/** Session-anchored VWAP (resets each trading day; US names anchor at the 9:30 open). */
export function vwapSeries(candles: Candle[], symbol: string): number[] {
  const us = followsUsHours(symbol);
  const out = new Array<number>(candles.length).fill(NaN);
  let day = "";
  let pv = 0;
  let vol = 0;
  candles.forEach((c, i) => {
    if (us && usSessionAt(c.t) !== "open") return;
    const d = sessionDay(symbol, c.t);
    if (d !== day) {
      day = d;
      pv = 0;
      vol = 0;
    }
    const tp = (c.h + c.l + c.c) / 3;
    const v = c.v || 1; // indices report no volume — fall back to equal weights
    pv += tp * v;
    vol += v;
    out[i] = pv / vol;
  });
  return out;
}

export function atr(candles: Candle[], n = 14): number {
  if (candles.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const p = candles[i - 1].c;
    trs.push(Math.max(c.h - c.l, Math.abs(c.h - p), Math.abs(c.l - p)));
  }
  const tail = trs.slice(-n);
  return tail.reduce((a, b) => a + b, 0) / tail.length;
}

/* ───────────── Day-trading levels ───────────── */

export interface DayStats {
  day: string;
  open: number;
  high: number;
  low: number;
  last: number;
  volume: number;
  vwap: number;
  prevClose: number;
  prevHigh: number;
  prevLow: number;
  gapPct: number;
  chPct: number;
  rangePct: number; // today's range as % of daily ATR
  atrDaily: number;
  relVol: number; // today's volume / 20-day average daily volume
  preHigh?: number;
  preLow?: number;
  orHigh?: number; // opening range (first 15 min)
  orLow?: number;
  orDone: boolean;
  pivots: { P: number; R1: number; R2: number; S1: number; S2: number };
}

/** Intraday statistics for the latest session. `daily` supplies prior-day levels and ATR. */
export function dayStats(intra: Candle[], daily: Candle[], symbol: string): DayStats | null {
  if (!intra.length) return null;
  const us = followsUsHours(symbol);
  const lastT = intra[intra.length - 1].t;
  const day = sessionDay(symbol, lastT);
  const today = intra.filter((c) => sessionDay(symbol, c.t) === day);
  const regular = us ? today.filter((c) => usSessionAt(c.t) === "open") : today;
  const pre = us ? today.filter((c) => usSessionAt(c.t) === "pre") : [];
  const base = regular.length ? regular : today;

  // previous day from daily bars (skip today's bar if present)
  const dailyDays = daily.map((c) => sessionDay(symbol, c.t + (us ? 14 * 3600 : 0)));
  let pi = daily.length - 1;
  while (pi >= 0 && dailyDays[pi] >= day) pi--;
  const prev = daily[pi] ?? base[0];
  const hist = daily.slice(Math.max(0, pi - 19), pi + 1);
  const avgVol = hist.reduce((a, c) => a + c.v, 0) / Math.max(1, hist.length);
  const atrDaily = atr(daily.slice(0, pi + 1), 14) || prev.h - prev.l;

  const open = base[0].o;
  const high = Math.max(...base.map((c) => c.h));
  const low = Math.min(...base.map((c) => c.l));
  const last = intra[intra.length - 1].c;
  const volume = base.reduce((a, c) => a + c.v, 0);
  const vw = vwapSeries(intra, symbol).filter((x) => isFinite(x));

  let orHigh: number | undefined;
  let orLow: number | undefined;
  let orDone = false;
  if (us && regular.length) {
    const or = regular.filter((c) => nyClock(c.t).mins < 585); // 9:30–9:45
    if (or.length) {
      orHigh = Math.max(...or.map((c) => c.h));
      orLow = Math.min(...or.map((c) => c.l));
      orDone = regular.some((c) => nyClock(c.t).mins >= 585);
    }
  }

  const P = (prev.h + prev.l + prev.c) / 3;
  return {
    day,
    open,
    high,
    low,
    last,
    volume,
    vwap: vw[vw.length - 1] ?? last,
    prevClose: prev.c,
    prevHigh: prev.h,
    prevLow: prev.l,
    gapPct: (open / prev.c - 1) * 100,
    chPct: (last / prev.c - 1) * 100,
    rangePct: atrDaily ? ((high - low) / atrDaily) * 100 : 0,
    atrDaily,
    relVol: avgVol ? volume / avgVol : 0,
    preHigh: pre.length ? Math.max(...pre.map((c) => c.h)) : undefined,
    preLow: pre.length ? Math.min(...pre.map((c) => c.l)) : undefined,
    orHigh,
    orLow,
    orDone,
    pivots: { P, R1: 2 * P - prev.l, R2: P + (prev.h - prev.l), S1: 2 * P - prev.h, S2: P - (prev.h - prev.l) },
  };
}

/* ───────────── Intraday signals ───────────── */

export interface TradeSignal {
  t: number;
  dir: "up" | "down";
  kind: "ema" | "vwap" | "orb" | "rsi" | "hod" | "lod";
  text: string;
}

/** Event scan over the latest session's bars on the active timeframe. */
export function scanSignals(candles: Candle[], symbol: string, stats: DayStats | null): TradeSignal[] {
  if (candles.length < 30) return [];
  const closes = candles.map((c) => c.c);
  const e9 = emaSeries(closes, 9);
  const e21 = emaSeries(closes, 21);
  const r = rsiSeries(closes, 14);
  const vw = vwapSeries(candles, symbol);
  const day = sessionDay(symbol, candles[candles.length - 1].t);
  const out: TradeSignal[] = [];
  let hod = -Infinity;
  let lod = Infinity;
  let orbUp = false;
  let orbDown = false;
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    if (sessionDay(symbol, c.t) !== day) continue;
    if (e9[i - 1] <= e21[i - 1] && e9[i] > e21[i]) out.push({ t: c.t, dir: "up", kind: "ema", text: "EMA9 пересекла EMA21 вверх" });
    if (e9[i - 1] >= e21[i - 1] && e9[i] < e21[i]) out.push({ t: c.t, dir: "down", kind: "ema", text: "EMA9 пересекла EMA21 вниз" });
    if (isFinite(vw[i]) && isFinite(vw[i - 1])) {
      if (closes[i - 1] <= vw[i - 1] && c.c > vw[i]) out.push({ t: c.t, dir: "up", kind: "vwap", text: "Возврат выше VWAP" });
      if (closes[i - 1] >= vw[i - 1] && c.c < vw[i]) out.push({ t: c.t, dir: "down", kind: "vwap", text: "Пробой VWAP вниз" });
    }
    if (r[i - 1] < 70 && r[i] >= 70) out.push({ t: c.t, dir: "down", kind: "rsi", text: "RSI > 70 — перекупленность" });
    if (r[i - 1] > 30 && r[i] <= 30) out.push({ t: c.t, dir: "up", kind: "rsi", text: "RSI < 30 — перепроданность" });
    if (stats?.orDone && stats.orHigh && stats.orLow && nyClock(c.t).mins >= 585) {
      if (!orbUp && c.c > stats.orHigh) {
        orbUp = true;
        out.push({ t: c.t, dir: "up", kind: "orb", text: "Пробой диапазона открытия вверх" });
      }
      if (!orbDown && c.c < stats.orLow) {
        orbDown = true;
        out.push({ t: c.t, dir: "down", kind: "orb", text: "Пробой диапазона открытия вниз" });
      }
    }
    const regular = !followsUsHours(symbol) || usSessionAt(c.t) === "open";
    if (regular) {
      if (hod !== -Infinity && c.h > hod && i > candles.length - 4) out.push({ t: c.t, dir: "up", kind: "hod", text: "Новый максимум дня" });
      if (lod !== Infinity && c.l < lod && i > candles.length - 4) out.push({ t: c.t, dir: "down", kind: "lod", text: "Новый минимум дня" });
      hod = Math.max(hod, c.h);
      lod = Math.min(lod, c.l);
    }
  }
  return out.slice(-30);
}

/* ───────────── Offline demo candles ───────────── */

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function demoCandles(symbol: string, tf: Timeframe, price: number, volPct: number, live: boolean): Candle[] {
  const step = TF_SECONDS[tf];
  const n = tf === "1m" ? 1500 : 800;
  const us = followsUsHours(symbol) && isIntraday(tf);
  const now = Math.floor(Date.now() / 1000 / step) * step;
  const times: number[] = [];
  for (let t = now; times.length < n; t -= step) {
    if (us && usSessionAt(t) === "closed") continue;
    if (!isIntraday(tf) && followsUsHours(symbol) && [0, 6].includes(new Date(t * 1000).getUTCDay())) continue;
    times.unshift(t);
  }
  const seed = [...`${symbol}${tf}`].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 11) + Math.floor(Date.now() / 86_400_000);
  const rnd = rng(seed);
  const sigma = (volPct / 100) * Math.sqrt(step / (365 * 86400)) * 1.6;
  const closes = new Array<number>(times.length);
  closes[times.length - 1] = price;
  for (let i = times.length - 1; i > 0; i--) {
    const g = Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    closes[i - 1] = closes[i] / Math.exp(sigma * g + Math.sin(i / 60) * sigma * 0.2);
  }
  const jitter = live ? 1 + (Math.random() - 0.5) * sigma * 0.8 : 1;
  // the live window is the tail of the same series, so it merges cleanly with the history
  const out = times.map((t, i) => {
    const c = i === times.length - 1 ? closes[i] * jitter : closes[i];
    const o = i ? closes[i - 1] : c;
    const wig = Math.abs(c - o) * 0.6 + c * sigma * 0.4 * rnd();
    const session = us ? usSessionAt(t) : "open";
    const vBase = session === "open" ? 1 : 0.15;
    return { t, o, h: Math.max(o, c) + wig * rnd(), l: Math.min(o, c) - wig * rnd(), c, v: Math.round(vBase * (2e5 + 8e5 * rnd())) };
  });
  return live ? out.slice(-120) : out;
}
