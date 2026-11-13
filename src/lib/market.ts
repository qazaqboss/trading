import "server-only";
import { ALL_ASSETS, DEMO_BASE } from "./assets";
import { computeMetrics } from "./indicators";
import { buildCorrelation, buildIdeas, buildRegime } from "./ideas";
import type { Asset, AssetDef, Bar, FearGreed, MarketPayload } from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const TTL_MS = 60_000;

let cache: { at: number; data: MarketPayload } | null = null;
let inflight: Promise<MarketPayload> | null = null;

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(id);
  }
}

interface YahooChart {
  chart: {
    result?: {
      meta: { regularMarketPrice?: number; regularMarketTime?: number };
      timestamp?: number[];
      indicators: { quote: { close: (number | null)[] }[] };
    }[];
    error?: { description?: string } | null;
  };
}

async function fetchYahoo(symbol: string): Promise<Bar[]> {
  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
  let lastErr: unknown;
  for (const host of hosts) {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=2y&interval=1d&includePrePost=false`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as YahooChart;
      const r = json.chart.result?.[0];
      if (!r?.timestamp) throw new Error(json.chart.error?.description ?? "пустой ответ");
      const closes = r.indicators.quote[0].close;
      const byDay = new Map<string, number>();
      r.timestamp.forEach((ts, i) => {
        const c = closes[i];
        if (c != null && isFinite(c)) byDay.set(new Date(ts * 1000).toISOString().slice(0, 10), c);
      });
      // use the live quote for today's bar when available
      const live = r.meta.regularMarketPrice;
      if (live && r.meta.regularMarketTime) {
        byDay.set(new Date(r.meta.regularMarketTime * 1000).toISOString().slice(0, 10), live);
      }
      const bars = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([t, c]) => ({ t, c }));
      if (bars.length < 60) throw new Error("недостаточно истории");
      return bars;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function fetchFearGreed(): Promise<FearGreed | null> {
  try {
    const res = await fetchWithTimeout("https://api.alternative.me/fng/?limit=30", 5000);
    if (!res.ok) return null;
    const json = (await res.json()) as { data: { value: string; value_classification: string }[] };
    const vals = json.data.map((d) => Number(d.value));
    return { value: vals[0], label: translateFng(json.data[0].value_classification), history: vals.reverse() };
  } catch {
    return null;
  }
}

function translateFng(s: string): string {
  const m: Record<string, string> = {
    "Extreme Fear": "Экстремальный страх",
    Fear: "Страх",
    Neutral: "Нейтрально",
    Greed: "Жадность",
    "Extreme Greed": "Экстремальная жадность",
  };
  return m[s] ?? s;
}

/** Deterministic pseudo-random generator so demo data is stable between reloads. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function demoBars(def: AssetDef): Bar[] {
  const cfg = DEMO_BASE[def.symbol] ?? { p: 100, vol: 0.3, drift: 0.05 };
  const seed = [...def.symbol].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7);
  const rnd = mulberry32(seed + Math.floor(Date.now() / 86_400_000));
  const weekends = def.cls === "crypto";
  const days: string[] = [];
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < 730; i++) {
    const wd = d.getUTCDay();
    if (weekends || (wd !== 0 && wd !== 6)) days.unshift(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  const n = days.length;
  const perYear = weekends ? 365 : 252;
  const sigma = cfg.vol / Math.sqrt(perYear);
  const mu = cfg.drift / perYear;
  // build backwards from today's level, with a slow regime wave for realistic trends
  const closes = new Array<number>(n);
  closes[n - 1] = cfg.p;
  const phase = rnd() * Math.PI * 2;
  for (let i = n - 1; i > 0; i--) {
    const gauss = Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    const wave = Math.sin(i / 45 + phase) * sigma * 0.35;
    closes[i - 1] = closes[i] / Math.exp(mu + wave + sigma * gauss);
  }
  return days.map((t, i) => ({ t, c: Number(closes[i].toPrecision(6)) }));
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
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

function toAsset(def: AssetDef, bars: Bar[]): Asset {
  const m = computeMetrics(bars, def.cls === "crypto" ? 365 : 252);
  // keep ~1 year of history for charts, enough for SMA200 overlays computed client-side
  return { ...def, history: bars.slice(-520), m };
}

async function build(): Promise<MarketPayload> {
  const forceDemo = process.env.MARKET_DEMO === "1";
  const errors: string[] = [];
  const [results, fearGreed] = await Promise.all([
    forceDemo
      ? Promise.resolve(ALL_ASSETS.map(() => ({ status: "rejected", reason: new Error("demo") }) as PromiseSettledResult<Bar[]>))
      : mapLimit(ALL_ASSETS, 6, (d) => fetchYahoo(d.symbol)),
    forceDemo ? Promise.resolve(null) : fetchFearGreed(),
  ]);

  const liveCount = results.filter((r) => r.status === "fulfilled").length;
  const useDemo = liveCount === 0;
  const assets: Asset[] = ALL_ASSETS.map((def, i) => {
    const r = results[i];
    if (r.status === "fulfilled") return toAsset(def, r.value);
    if (!useDemo) errors.push(`${def.ticker}: ${(r.reason as Error)?.message ?? "ошибка"}`);
    return useDemo ? toAsset(def, demoBars(def)) : null;
  }).filter((a): a is Asset => !!a);

  if (useDemo && !forceDemo) errors.unshift("Источник котировок недоступен — показаны демо-данные");

  const fg: FearGreed | null =
    fearGreed ??
    (useDemo
      ? { value: 62, label: "Жадность", history: Array.from({ length: 30 }, (_, i) => Math.round(50 + 15 * Math.sin(i / 4))) }
      : null);

  return {
    updatedAt: new Date().toISOString(),
    source: useDemo ? "demo" : "live",
    errors,
    assets,
    ideas: buildIdeas(assets),
    regime: buildRegime(assets),
    correlation: buildCorrelation(assets),
    fearGreed: fg,
  };
}

export async function getMarket(): Promise<MarketPayload> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  inflight ??= build()
    .then((data) => {
      cache = { at: Date.now(), data };
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
