import "server-only";
import type { Bar, Candle, LiveQuote, Mover, Timeframe } from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];

export async function fetchWithTimeout(url: string, ms = 8000, accept = "application/json"): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { headers: { "User-Agent": UA, Accept: accept }, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(id);
  }
}

/** Try each Yahoo host until one answers with valid JSON. */
async function yahooJson<T>(path: string, ms = 8000): Promise<T> {
  let lastErr: unknown;
  for (const host of HOSTS) {
    try {
      const res = await fetchWithTimeout(`https://${host}${path}`, ms);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

interface ChartMeta {
  symbol?: string;
  regularMarketPrice?: number;
  regularMarketTime?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  longName?: string;
  shortName?: string;
  currency?: string;
  exchangeName?: string;
}

interface ChartResult {
  meta: ChartMeta;
  timestamp?: number[];
  indicators: { quote: { close: (number | null)[] }[] };
}

interface YahooChart {
  chart: { result?: ChartResult[]; error?: { description?: string } | null };
}

const day = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 10);

/** ~2 years of daily closes (plus today's live price) and the instrument name. */
export async function fetchHistory(symbol: string): Promise<{ bars: Bar[]; name?: string }> {
  const json = await yahooJson<YahooChart>(
    `/v8/finance/chart/${encodeURIComponent(symbol)}?range=2y&interval=1d&includePrePost=false`,
  );
  const r = json.chart.result?.[0];
  if (!r?.timestamp) throw new Error(json.chart.error?.description ?? "пустой ответ");
  const closes = r.indicators.quote[0]?.close ?? [];
  const byDay = new Map<string, number>();
  r.timestamp.forEach((ts, i) => {
    const c = closes[i];
    if (c != null && isFinite(c)) byDay.set(day(ts), c);
  });
  if (r.meta.regularMarketPrice && r.meta.regularMarketTime) {
    byDay.set(day(r.meta.regularMarketTime), r.meta.regularMarketPrice);
  }
  const bars = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([t, c]) => ({ t, c }));
  if (bars.length < 1) throw new Error("нет истории");
  return { bars, name: r.meta.longName ?? r.meta.shortName };
}

/* ───────────── Live quotes ───────────── */

function downsample(xs: number[], n = 48): number[] {
  if (xs.length <= n) return xs;
  const step = xs.length / n;
  return Array.from({ length: n }, (_, i) => xs[Math.floor(i * step)]).concat(xs[xs.length - 1]);
}

function toQuote(symbol: string, r: ChartResult | undefined): LiveQuote | null {
  if (!r?.meta) return null;
  const closes = (r.indicators?.quote?.[0]?.close ?? []).filter((c): c is number => c != null && isFinite(c));
  const price = r.meta.regularMarketPrice ?? closes[closes.length - 1];
  const prev = r.meta.chartPreviousClose ?? r.meta.previousClose;
  if (!price || !prev) return null;
  return {
    symbol,
    price,
    prevClose: prev,
    chPct: (price / prev - 1) * 100,
    time: r.meta.regularMarketTime ?? Math.floor(Date.now() / 1000),
    name: r.meta.shortName ?? r.meta.longName,
    spark: downsample(closes),
  };
}

interface YahooSpark {
  spark?: { result?: { symbol: string; response?: ChartResult[] }[] };
}

/** Batched quotes via the spark endpoint (20 symbols per call). */
async function sparkBatch(symbols: string[]): Promise<LiveQuote[]> {
  const json = await yahooJson<YahooSpark>(
    `/v7/finance/spark?symbols=${symbols.map(encodeURIComponent).join(",")}&range=1d&interval=5m&includePrePost=false`,
    6000,
  );
  return (json.spark?.result ?? [])
    .map((x) => toQuote(x.symbol, x.response?.[0]))
    .filter((q): q is LiveQuote => !!q);
}

async function chartQuote(symbol: string): Promise<LiveQuote | null> {
  const json = await yahooJson<YahooChart>(
    `/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m&includePrePost=false`,
    6000,
  );
  return toQuote(symbol, json.chart.result?.[0]);
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        try {
          out[i] = { status: "fulfilled", value: await fn(items[i]) };
        } catch (reason) {
          out[i] = { status: "rejected", reason };
        }
      }
    }),
  );
  return out;
}

const QUOTE_TTL = 4000;
const quoteCache = new Map<string, { at: number; q: LiveQuote }>();

export async function fetchQuotes(symbols: string[]): Promise<LiveQuote[]> {
  const now = Date.now();
  const fresh: LiveQuote[] = [];
  const missing: string[] = [];
  for (const s of symbols) {
    const c = quoteCache.get(s);
    if (c && now - c.at < QUOTE_TTL) fresh.push(c.q);
    else missing.push(s);
  }
  if (missing.length) {
    const got = new Map<string, LiveQuote>();
    const chunks: string[][] = [];
    for (let i = 0; i < missing.length; i += 20) chunks.push(missing.slice(i, i + 20));
    const res = await mapLimit(chunks, 4, sparkBatch);
    res.forEach((r) => r.status === "fulfilled" && r.value.forEach((q) => got.set(q.symbol, q)));
    // fall back to one chart request per symbol for anything spark did not return
    const rest = missing.filter((s) => !got.has(s));
    if (rest.length) {
      const res2 = await mapLimit(rest, 8, chartQuote);
      res2.forEach((r) => r.status === "fulfilled" && r.value && got.set(r.value.symbol, r.value));
    }
    for (const q of got.values()) {
      quoteCache.set(q.symbol, { at: now, q });
      fresh.push(q);
    }
    if (quoteCache.size > 5000) quoteCache.clear();
  }
  return fresh;
}

/* ───────────── Movers & search ───────────── */

interface ScreenerQuote {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  marketCap?: number;
}

export async function fetchScreener(id: "day_gainers" | "day_losers" | "most_actives", count = 25): Promise<Mover[]> {
  const json = await yahooJson<{ finance: { result?: { quotes?: ScreenerQuote[] }[] } }>(
    `/v1/finance/screener/predefined/saved?formatted=false&lang=en-US&region=US&scrIds=${id}&count=${count}`,
  );
  return (json.finance.result?.[0]?.quotes ?? [])
    .filter((q) => q.regularMarketPrice != null)
    .map((q) => ({
      symbol: q.symbol,
      name: q.shortName ?? q.longName ?? q.symbol,
      price: q.regularMarketPrice!,
      chPct: q.regularMarketChangePercent ?? 0,
      volume: q.regularMarketVolume ?? 0,
      marketCap: q.marketCap ?? 0,
    }));
}

export async function searchSymbols(q: string): Promise<{ symbol: string; name: string; exch: string; type: string }[]> {
  const json = await yahooJson<{ quotes?: { symbol: string; shortname?: string; longname?: string; exchDisp?: string; quoteType?: string }[] }>(
    `/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0&listsCount=0`,
    5000,
  );
  return (json.quotes ?? [])
    .filter((x) => x.symbol && ["EQUITY", "ETF", "INDEX", "CRYPTOCURRENCY", "FUTURE"].includes(x.quoteType ?? ""))
    .map((x) => ({ symbol: x.symbol, name: x.longname ?? x.shortname ?? x.symbol, exch: x.exchDisp ?? "", type: x.quoteType ?? "" }));
}

/* ───────────── OHLCV candles ───────────── */


export const TF_YAHOO: Record<Timeframe, { interval: string; full: string; live: string; prepost: boolean }> = {
  "1m": { interval: "1m", full: "5d", live: "1d", prepost: true },
  "5m": { interval: "5m", full: "1mo", live: "1d", prepost: true },
  "15m": { interval: "15m", full: "1mo", live: "5d", prepost: true },
  "1h": { interval: "60m", full: "6mo", live: "5d", prepost: false },
  "1d": { interval: "1d", full: "5y", live: "5d", prepost: false },
  "1wk": { interval: "1wk", full: "10y", live: "1mo", prepost: false },
};

interface OhlcResult {
  meta: ChartMeta;
  timestamp?: number[];
  indicators: { quote: { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[]; volume: (number | null)[] }[] };
}

const candleCache = new Map<string, { at: number; v: { candles: Candle[]; name?: string } }>();

export async function fetchCandles(symbol: string, tf: Timeframe, live: boolean): Promise<{ candles: Candle[]; name?: string }> {
  const cfg = TF_YAHOO[tf];
  const range = live ? cfg.live : cfg.full;
  const key = `${symbol}|${tf}|${range}`;
  const hit = candleCache.get(key);
  if (hit && Date.now() - hit.at < 4000) return hit.v;

  const json = await yahooJson<{ chart: { result?: OhlcResult[]; error?: { description?: string } | null } }>(
    `/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${cfg.interval}&includePrePost=${cfg.prepost}`,
  );
  const r = json.chart.result?.[0];
  if (!r?.timestamp) throw new Error(json.chart.error?.description ?? "пустой ответ");
  const q = r.indicators.quote[0];
  const candles: Candle[] = [];
  r.timestamp.forEach((t, i) => {
    const o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i];
    if (o == null || h == null || l == null || c == null) return;
    candles.push({ t, o, h, l, c, v: q.volume[i] ?? 0 });
  });
  // Yahoo's daily/weekly bars lag the live quote — patch the last bar with it
  const last = candles[candles.length - 1];
  const px = r.meta.regularMarketPrice;
  if (last && px && (tf === "1d" || tf === "1wk")) {
    last.c = px;
    last.h = Math.max(last.h, px);
    last.l = Math.min(last.l, px);
  }
  const v = { candles, name: r.meta.longName ?? r.meta.shortName };
  candleCache.set(key, { at: Date.now(), v });
  if (candleCache.size > 2000) candleCache.clear();
  return v;
}
