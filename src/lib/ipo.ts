import "server-only";
import { etToUnix, yahooCrumb } from "./finviz";
import type { Bar, GhStock, IpoItem, LiveQuote } from "./types";

/*
 * Sources
 *  • github.com/rreichel3/US-Stock-Symbols — nightly snapshot of every NASDAQ/NYSE/AMEX listing
 *    (name, last price, market cap, sector, IPO year). Its git history gives "new tickers".
 *  • Nasdaq IPO calendar (api.nasdaq.com/api/ipo/calendar) — upcoming / priced / filed deals.
 *  • Yahoo visualization API, entityIdType "ipo_info" — same request yfinance's
 *    Calendars.get_ipo_info_calendar() sends (github.com/ranaroussi/yfinance), used as a fallback.
 *  • Nasdaq quote API — price/history fallback for brand-new tickers Yahoo doesn't know yet.
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const GH_REPO = "rreichel3/US-Stock-Symbols";
const GH_RAW = `https://raw.githubusercontent.com/${GH_REPO}`;

async function getJson<T>(url: string, ms = 10000, headers: Record<string, string> = {}): Promise<T> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json, text/plain, */*", ...headers }, signal: ctrl.signal, cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(id);
  }
}

const num = (s?: string | number | null): number | undefined => {
  if (s == null) return undefined;
  if (typeof s === "number") return isFinite(s) ? s : undefined;
  const v = Number(s.replace(/[$,%\s]/g, ""));
  return isFinite(v) && s.trim() !== "" ? v : undefined;
};
const ghSymbol = (s: string) => s.trim().replace(/\//g, "-");

/* ───────────── GitHub: full US listings snapshot ───────────── */

interface GhRaw {
  symbol: string;
  name: string;
  lastsale: string;
  pctchange: string;
  volume: string;
  marketCap: string;
  country: string;
  ipoyear: string;
  industry: string;
  sector: string;
}

let ghCache: { at: number; rows: GhStock[] } | null = null;

export async function githubListings(): Promise<GhStock[]> {
  if (ghCache && Date.now() - ghCache.at < 6 * 3600_000) return ghCache.rows;
  const files: [string, string][] = [
    ["nasdaq/nasdaq_full_tickers.json", "Nasdaq"],
    ["nyse/nyse_full_tickers.json", "NYSE"],
    ["amex/amex_full_tickers.json", "NYSE American"],
  ];
  const parts = await Promise.all(files.map(([f]) => getJson<GhRaw[]>(`${GH_RAW}/main/${f}`, 15000)));
  const rows: GhStock[] = [];
  parts.forEach((list, i) => {
    for (const r of list) {
      if (!r.symbol || /[\^$]/.test(r.symbol)) continue;
      rows.push({
        symbol: ghSymbol(r.symbol),
        name: r.name.replace(/\s+(Common Stock|Ordinary Shares|Class A Common Stock|Class A Ordinary Shares?)$/i, "").trim(),
        exchange: files[i][1],
        sector: r.sector || undefined,
        industry: r.industry || undefined,
        country: r.country || undefined,
        ipoYear: num(r.ipoyear),
        marketCap: num(r.marketCap),
        last: num(r.lastsale),
        pct: num(r.pctchange),
        volume: num(r.volume),
      });
    }
  });
  if (rows.length < 1000) throw new Error("GitHub: слишком короткий список");
  ghCache = { at: Date.now(), rows };
  return rows;
}

let newCache: { at: number; v: { since: string; added: string[]; removed: string[] } } | null = null;

/** Symbols added/removed over the last `days`, from the repo's git history of all/all_tickers.txt. */
export async function githubNewTickers(days = 7): Promise<{ since: string; added: string[]; removed: string[] }> {
  if (newCache && Date.now() - newCache.at < 6 * 3600_000) return newCache.v;
  const until = new Date(Date.now() - days * 86400_000).toISOString();
  const commits = await getJson<{ sha: string; commit: { committer: { date: string } } }[]>(
    `https://api.github.com/repos/${GH_REPO}/commits?path=all/all_tickers.txt&until=${until}&per_page=1`,
    10000,
    { Accept: "application/vnd.github+json" },
  );
  if (!commits[0]) throw new Error("GitHub: нет истории");
  const [now, then] = await Promise.all(
    [`${GH_RAW}/main/all/all_tickers.txt`, `${GH_RAW}/${commits[0].sha}/all/all_tickers.txt`].map(async (u) => {
      const r = await fetch(u, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return new Set((await r.text()).split(/\r?\n/).map((s) => ghSymbol(s)).filter(Boolean));
    }),
  );
  const v = {
    since: commits[0].commit.committer.date.slice(0, 10),
    added: [...now].filter((s) => !then.has(s)).sort(),
    removed: [...then].filter((s) => !now.has(s)).sort(),
  };
  newCache = { at: Date.now(), v };
  return v;
}

/* ───────────── IPO calendars ───────────── */

const NASDAQ_HEADERS = { Origin: "https://www.nasdaq.com", Referer: "https://www.nasdaq.com/", "Accept-Language": "en-US,en;q=0.9" };

type NRow = Record<string, string | null | undefined>;
interface NasdaqIpo {
  data?: {
    priced?: { rows?: NRow[] | null };
    upcoming?: { upcomingTable?: { rows?: NRow[] | null } };
    filed?: { rows?: NRow[] | null };
    withdrawn?: { rows?: NRow[] | null };
  } | null;
}

/** "11/20/2026" → "2026-11-20" */
function usDate(s?: string | null): string | undefined {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s ?? "");
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : undefined;
}

function priceRange(s?: string | null): { lo?: number; hi?: number } {
  const p = (s ?? "").split("-").map((x) => num(x)).filter((x): x is number => x != null);
  return { lo: p[0], hi: p[1] ?? p[0] };
}

export function parseNasdaqIpo(j: NasdaqIpo): IpoItem[] {
  const d = j.data;
  if (!d) return [];
  const out: IpoItem[] = [];
  const base = (r: NRow) => ({
    symbol: r.proposedTickerSymbol?.trim() || undefined,
    company: (r.companyName ?? "").trim(),
    exchange: r.proposedExchange?.trim() || undefined,
    shares: num(r.sharesOffered),
    dealSize: num(r.dollarValueOfSharesOffered),
    source: "Nasdaq",
  });
  for (const r of d.upcoming?.upcomingTable?.rows ?? []) {
    const { lo, hi } = priceRange(r.proposedSharePrice);
    out.push({ ...base(r), status: "upcoming", date: usDate(r.expectedPriceDate), priceLow: lo, priceHigh: hi });
  }
  for (const r of d.priced?.rows ?? []) {
    const { lo } = priceRange(r.proposedSharePrice);
    out.push({ ...base(r), status: "priced", date: usDate(r.pricedDate), price: lo });
  }
  for (const r of d.filed?.rows ?? []) out.push({ ...base(r), status: "filed", date: usDate(r.filedDate) });
  for (const r of d.withdrawn?.rows ?? []) out.push({ ...base(r), status: "withdrawn", date: usDate(r.withdrawDate ?? r.filedDate) });
  return out.filter((x) => x.company);
}

async function nasdaqIpos(): Promise<IpoItem[]> {
  const now = new Date();
  const months = [-1, 0, 1].map((k) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + k, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const res = await Promise.allSettled(months.map((m) => getJson<NasdaqIpo>(`https://api.nasdaq.com/api/ipo/calendar?date=${m}`, 10000, NASDAQ_HEADERS)));
  const ok = res.filter((r): r is PromiseFulfilledResult<NasdaqIpo> => r.status === "fulfilled");
  if (!ok.length) throw new Error("Nasdaq IPO недоступен");
  return ok.flatMap((r) => parseNasdaqIpo(r.value));
}

interface YahooViz {
  finance: { result?: { documents: { columns: { id: string; label: string }[]; rows: (string | number | null)[][] }[] }[]; error?: unknown };
}

export function parseYahooIpo(j: YahooViz): IpoItem[] {
  const doc = j.finance.result?.[0]?.documents?.[0];
  if (!doc) return [];
  const idx = (id: string) => doc.columns.findIndex((c) => c.id === id);
  const col = { t: idx("ticker"), n: idx("companyshortname"), ex: idx("exchange_short_name"), fd: idx("filingdate"), sd: idx("startdatetime"), pf: idx("pricefrom"), pt: idx("priceto"), op: idx("offerprice"), sh: idx("shares"), dt: idx("dealtype") };
  const today = new Date().toISOString().slice(0, 10);
  return doc.rows.map((r) => {
    const g = (i: number) => (i >= 0 ? r[i] : null);
    const date = String(g(col.sd) ?? g(col.fd) ?? "").slice(0, 10) || undefined;
    const deal = String(g(col.dt) ?? "").toLowerCase();
    const offer = num(g(col.op) as number) || undefined;
    const status: IpoItem["status"] = /withdraw/.test(deal)
      ? "withdrawn"
      : /price/.test(deal) || (offer && date && date <= today)
        ? "priced"
        : /expect|upcoming/.test(deal) || (date && date >= today && g(col.sd))
          ? "upcoming"
          : "filed";
    return {
      symbol: (g(col.t) as string) || undefined,
      company: String(g(col.n) ?? ""),
      exchange: (g(col.ex) as string) || undefined,
      date,
      status,
      priceLow: num(g(col.pf) as number) || undefined,
      priceHigh: num(g(col.pt) as number) || undefined,
      price: offer,
      shares: num(g(col.sh) as number) || undefined,
      source: "Yahoo",
    };
  }).filter((x) => x.company);
}

async function yahooIpos(): Promise<IpoItem[]> {
  const { cookie, crumb } = await yahooCrumb();
  const d = (k: number) => new Date(Date.now() + k * 86400_000).toISOString().slice(0, 10);
  const range = [d(-45), d(60)];
  const body = {
    sortType: "DESC",
    entityIdType: "ipo_info",
    sortField: "startdatetime",
    includeFields: ["ticker", "companyshortname", "exchange_short_name", "filingdate", "startdatetime", "amendeddate", "pricefrom", "priceto", "offerprice", "currencyname", "shares", "dealtype"],
    size: 100,
    offset: 0,
    query: {
      operator: "OR",
      operands: [
        { operator: "GTELT", operands: ["startdatetime", ...range] },
        { operator: "GTELT", operands: ["filingdate", ...range] },
        { operator: "GTELT", operands: ["amendeddate", ...range] },
      ],
    },
  };
  const r = await fetch(`https://query1.finance.yahoo.com/v1/finance/visualization?lang=en-US&region=US&crumb=${encodeURIComponent(crumb)}`, {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/json", Accept: "application/json", cookie },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Yahoo IPO HTTP ${r.status}`);
  return parseYahooIpo((await r.json()) as YahooViz);
}

let ipoCache: { at: number; v: { items: IpoItem[]; sources: string[]; errors: string[] } } | null = null;

export async function ipoCalendar() {
  if (ipoCache && Date.now() - ipoCache.at < 20 * 60_000) return ipoCache.v;
  const [n, y] = await Promise.allSettled([nasdaqIpos(), yahooIpos()]);
  const errors: string[] = [];
  const sources: string[] = [];
  const merged = new Map<string, IpoItem>();
  const key = (i: IpoItem) => (i.symbol ? `S:${i.symbol}` : `C:${i.company.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24)}`);
  for (const [res, name] of [[n, "Nasdaq"], [y, "Yahoo"]] as const) {
    if (res.status === "rejected") {
      errors.push(`${name}: ${(res.reason as Error).message}`);
      continue;
    }
    if (res.value.length) sources.push(name);
    for (const it of res.value) {
      const k = key(it);
      const prev = merged.get(k);
      merged.set(k, prev ? { ...it, ...Object.fromEntries(Object.entries(prev).filter(([, v]) => v != null)) } : it);
    }
  }
  const v = { items: [...merged.values()], sources, errors };
  if (v.items.length) ipoCache = { at: Date.now(), v };
  return v;
}

/* ───────────── Nasdaq quote fallbacks for brand-new tickers ───────────── */

interface NasdaqInfo {
  data?: { companyName?: string; primaryData?: { lastSalePrice?: string; netChange?: string; percentageChange?: string; lastTradeTimestamp?: string } } | null;
}

export async function nasdaqQuote(symbol: string): Promise<LiveQuote | null> {
  const j = await getJson<NasdaqInfo>(`https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/info?assetclass=stocks`, 7000, NASDAQ_HEADERS);
  const p = j.data?.primaryData;
  const price = num(p?.lastSalePrice);
  const ch = num(p?.netChange) ?? 0;
  if (!price) return null;
  const prev = price - ch;
  return { symbol, price, prevClose: prev, chPct: prev ? (price / prev - 1) * 100 : 0, time: Math.floor(Date.now() / 1000), name: j.data?.companyName };
}

interface NasdaqHist {
  data?: { tradesTable?: { rows?: { date: string; close: string; open: string; high: string; low: string; volume: string }[] } } | null;
}

/** Daily history from Nasdaq (oldest first). Works for tickers listed only days ago. */
export async function nasdaqHistory(symbol: string): Promise<{ bars: Bar[]; ohlc: { t: number; o: number; h: number; l: number; c: number; v: number }[] }> {
  const from = new Date(Date.now() - 2 * 365 * 86400_000).toISOString().slice(0, 10);
  const j = await getJson<NasdaqHist>(
    `https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/historical?assetclass=stocks&fromdate=${from}&limit=9999`,
    10000,
    NASDAQ_HEADERS,
  );
  const rows = j.data?.tradesTable?.rows ?? [];
  const ohlc = rows
    .map((r) => {
      const d = usDate(r.date);
      if (!d) return null;
      const [y, m, dd] = d.split("-").map(Number);
      return { t: etToUnix(y, m - 1, dd, 9, 30), o: num(r.open) ?? 0, h: num(r.high) ?? 0, l: num(r.low) ?? 0, c: num(r.close) ?? 0, v: num(r.volume) ?? 0, d };
    })
    .filter((x): x is NonNullable<typeof x> => !!x && x.c > 0)
    .sort((a, b) => a.t - b.t);
  if (!ohlc.length) throw new Error("Nasdaq: нет истории");
  return { bars: ohlc.map((x) => ({ t: x.d, c: x.c })), ohlc: ohlc.map(({ d, ...x }) => (void d, x)) };
}
