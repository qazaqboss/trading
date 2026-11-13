import type { Bar, Metrics } from "./types";

export function sma(values: number[], period: number): number {
  if (values.length < period) return NaN;
  let s = 0;
  for (let i = values.length - period; i < values.length; i++) s += values[i];
  return s / period;
}

/** Simple moving average series aligned with the input (NaN until enough data). */
export function smaSeries(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  let s = 0;
  for (let i = 0; i < values.length; i++) {
    s += values[i];
    if (i >= period) s -= values[i - period];
    if (i >= period - 1) out[i] = s / period;
  }
  return out;
}

/** Wilder RSI on closes. */
export function rsi(values: number[], period = 14): number {
  if (values.length <= period) return 50;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d > 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (loss === 0) return 100;
  return 100 - 100 / (1 + gain / loss);
}

export function pct(a: number, b: number): number {
  if (!isFinite(a) || !isFinite(b) || b === 0) return 0;
  return (a / b - 1) * 100;
}

export function logReturns(values: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < values.length; i++) r.push(Math.log(values[i] / values[i - 1]));
  return r;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

export function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 5) return 0;
  const x = a.slice(-n);
  const y = b.slice(-n);
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}

/** Close `n` sessions back, or at a calendar date for YTD/1Y lookups. */
function closeBack(bars: Bar[], n: number): number {
  return bars[Math.max(0, bars.length - 1 - n)]?.c ?? NaN;
}

function closeOnOrBefore(bars: Bar[], date: string): number {
  for (let i = bars.length - 1; i >= 0; i--) if (bars[i].t <= date) return bars[i].c;
  return bars[0]?.c ?? NaN;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function computeMetrics(bars: Bar[], daysPerYear: number): Metrics {
  const closes = bars.map((b) => b.c);
  const last = closes[closes.length - 1];
  const lastDate = bars[bars.length - 1].t;
  const prevYearEnd = `${Number(lastDate.slice(0, 4)) - 1}-12-31`;
  const d = new Date(lastDate);
  d.setFullYear(d.getFullYear() - 1);
  const yearAgo = d.toISOString().slice(0, 10);

  // sessions per period depend on whether the asset trades 7 days a week
  const wk = daysPerYear > 300 ? 7 : 5;
  const mo = daysPerYear > 300 ? 30 : 21;

  const window52 = bars.filter((b) => b.t > yearAgo).map((b) => b.c);
  const high52 = Math.max(...window52);
  const low52 = Math.min(...window52);

  const s20 = sma(closes, 20);
  const s50 = sma(closes, 50);
  const s200 = sma(closes, Math.min(200, closes.length));

  const rets = logReturns(closes.slice(-31));
  const vol30 = stdev(rets) * Math.sqrt(daysPerYear) * 100;
  const absMoves = closes.slice(-15).map((c, i, arr) => (i ? Math.abs(c - arr[i - 1]) : 0)).slice(1);
  const atr = absMoves.reduce((a, b) => a + b, 0) / Math.max(1, absMoves.length);

  // SMA50/200 cross detection within the last 15 sessions
  const s50s = smaSeries(closes, 50);
  const s200s = smaSeries(closes, 200);
  let cross: Metrics["cross"] = null;
  for (let i = closes.length - 15; i < closes.length; i++) {
    if (i < 1 || isNaN(s200s[i - 1])) continue;
    const prev = s50s[i - 1] - s200s[i - 1];
    const cur = s50s[i] - s200s[i];
    if (prev <= 0 && cur > 0) cross = "golden";
    if (prev >= 0 && cur < 0) cross = "death";
  }

  const r = rsi(closes, 14);
  const ch1m = pct(last, closeBack(bars, mo));
  const ch3m = pct(last, closeBack(bars, mo * 3));

  // composite score: trend structure + momentum + RSI regime
  let score = 0;
  score += last > s200 ? 25 : -25;
  score += last > s50 ? 15 : -15;
  score += s50 > s200 ? 15 : -15;
  score += clamp(ch1m * 1.5, -15, 15) * (20 / Math.max(vol30, 20));
  score += clamp(ch3m * 0.7, -15, 15) * (20 / Math.max(vol30, 20));
  score += clamp((r - 50) * 0.6, -15, 15);
  score = Math.round(clamp(score, -100, 100));

  const trend: Metrics["trend"] =
    last > s50 && s50 > s200 ? "up" : last < s50 && s50 < s200 ? "down" : "flat";

  return {
    price: last,
    ch1d: pct(last, closeBack(bars, 1)),
    ch1w: pct(last, closeBack(bars, wk)),
    ch1m,
    ch3m,
    chYtd: pct(last, closeOnOrBefore(bars, prevYearEnd)),
    ch1y: pct(last, closeOnOrBefore(bars, yearAgo)),
    high52,
    low52,
    fromHigh: pct(last, high52),
    rsi14: r,
    sma20: s20,
    sma50: s50,
    sma200: s200,
    vol30,
    atr,
    cross,
    trend,
    score,
  };
}
