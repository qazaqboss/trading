import "server-only";
import { parse, type HTMLElement } from "node-html-parser";
import type { Fundamentals, NewsItem } from "./types";
import { fetchWithTimeout } from "./yahoo";

/*
 * Finviz scraping follows the selectors used by the open-source
 * lit26/finvizfinance project (github.com/lit26/finvizfinance):
 *   quote page  → table.snapshot-table2 (label/value cell pairs),
 *                 table.fullview-news-outer (ticker news),
 *                 h2.quote-header_ticker-wrapper_company, div.quote-links;
 *   news page   → #news tables (row: icon | time | link).
 */

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

async function getHtml(url: string, ms = 9000): Promise<string> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, signal: ctrl.signal, cache: "no-store" });
    const body = await res.text();
    if (res.headers.get("cf-mitigated") === "challenge" || /Just a moment|cf-chl|challenge-platform/.test(body.slice(0, 5000)))
      throw new Error("Finviz: защита Cloudflare");
    if (!res.ok) throw new Error(`Finviz HTTP ${res.status}`);
    return body;
  } finally {
    clearTimeout(id);
  }
}

/* ───────────── New York wall time → unix ───────────── */

const nyParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
});

function nyWallMs(ms: number): number {
  const p: Record<string, number> = {};
  for (const x of nyParts.formatToParts(new Date(ms))) if (x.type !== "literal") p[x.type] = Number(x.value);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
}

export function etToUnix(y: number, mo: number, d: number, h: number, mi: number): number {
  const guess = Date.UTC(y, mo, d, h, mi);
  const off = nyWallMs(guess) - guess;
  return Math.round((guess - off) / 1000);
}

const MONTHS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

function nyToday(): { y: number; mo: number; d: number } {
  const w = new Date(nyWallMs(Date.now()));
  return { y: w.getUTCFullYear(), mo: w.getUTCMonth(), d: w.getUTCDate() };
}

function parseClock(s: string): { h: number; mi: number } | null {
  const m = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(s);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  return { h, mi: Number(m[2]) };
}

/** Finviz quote-page stamp: "Nov-20-26 09:30AM", "Today 09:30AM" or a bare "09:30AM" (same day as previous row). */
export function parseFinvizStamp(raw: string, lastDay: { y: number; mo: number; d: number } | null) {
  const s = raw.replace(/\s+/g, " ").trim();
  const dm = /([A-Z][a-z]{2})-(\d{2})-(\d{2})/.exec(s);
  let day = lastDay;
  if (dm) day = { y: 2000 + Number(dm[3]), mo: MONTHS[dm[1]], d: Number(dm[2]) };
  else if (/^Today/i.test(s)) day = nyToday();
  else if (/^Yesterday/i.test(s)) {
    const t = nyToday();
    const y = new Date(Date.UTC(t.y, t.mo, t.d - 1));
    day = { y: y.getUTCFullYear(), mo: y.getUTCMonth(), d: y.getUTCDate() };
  }
  day ??= nyToday();
  const c = parseClock(s) ?? { h: 12, mi: 0 };
  return { t: etToUnix(day.y, day.mo, day.d, c.h, c.mi), day };
}

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/* ───────────── Quote page: fundamentals + ticker news ───────────── */

export function parseQuotePage(html: string, symbol: string): Fundamentals {
  const root = parse(html);
  const fields: Record<string, string> = {};
  for (const table of root.querySelectorAll("table.snapshot-table2")) {
    for (const row of table.querySelectorAll("tr")) {
      const cells = row.querySelectorAll("td").map((td) => td.text.replace(/\s+/g, " ").trim());
      for (let i = 0; i + 1 < cells.length; i += 2) {
        let key = cells[i];
        if (!key) continue;
        if (key === "EPS next Y" && key in fields) key = "EPS next Y %";
        fields[key] = cells[i + 1];
      }
    }
  }
  if (!Object.keys(fields).length) throw new Error("Finviz: таблица показателей не найдена");

  const links = root.querySelector("div.quote-links")?.querySelectorAll("a") ?? [];
  const byHref = (token: string) => root.querySelectorAll("a").find((a) => (a.getAttribute("href") ?? "").includes(token))?.text.trim();
  const cls = (i: number, token: string) => links[i]?.text.trim() || byHref(token);

  const news: NewsItem[] = [];
  let lastDay: { y: number; mo: number; d: number } | null = null;
  for (const row of root.querySelector("table.fullview-news-outer")?.querySelectorAll("tr") ?? []) {
    const cols = row.querySelectorAll("td");
    const a = cols[1]?.querySelector("a");
    if (cols.length < 2 || !a) continue;
    const { t, day } = parseFinvizStamp(cols[0].text, lastDay);
    lastDay = day;
    const href = a.getAttribute("href") ?? "";
    const url = href.startsWith("/") ? `https://finviz.com${href}` : href;
    const src = cols[1].querySelector("span")?.text.replace(/[()]/g, "").trim() || hostOf(url);
    news.push({ id: hash(url + a.text), title: decode(a.text.trim()), url, source: src, time: t, tickers: [symbol] });
  }

  return {
    symbol,
    source: "finviz",
    name: root.querySelector("h2.quote-header_ticker-wrapper_company")?.text.trim() || undefined,
    sector: cls(0, "f=sec_"),
    industry: cls(1, "f=ind_"),
    country: cls(2, "f=geo_"),
    exchange: cls(3, "f=exch_"),
    fields,
    news,
    updatedAt: new Date().toISOString(),
  };
}

const quoteCache = new Map<string, { at: number; v: Fundamentals }>();

export async function finvizQuote(symbol: string): Promise<Fundamentals> {
  const hit = quoteCache.get(symbol);
  if (hit && Date.now() - hit.at < 60_000) return hit.v;
  const html = await getHtml(`https://finviz.com/quote.ashx?t=${encodeURIComponent(symbol)}&p=d`);
  const v = parseQuotePage(html, symbol);
  quoteCache.set(symbol, { at: Date.now(), v });
  if (quoteCache.size > 500) quoteCache.delete(quoteCache.keys().next().value!);
  return v;
}

/* ───────────── Yahoo fallback (cookie + crumb, as yfinance does) ───────────── */

let crumbCache: { at: number; cookie: string; crumb: string } | null = null;

async function yahooCrumb() {
  if (crumbCache && Date.now() - crumbCache.at < 3600_000) return crumbCache;
  const r1 = await fetch("https://fc.yahoo.com", { headers: BROWSER_HEADERS, redirect: "manual", cache: "no-store" }).catch(() => null);
  const setCookies = r1?.headers.getSetCookie?.() ?? [];
  const cookie = setCookies.map((c) => c.split(";")[0]).join("; ");
  if (!cookie) throw new Error("Yahoo: нет cookie");
  const r2 = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", { headers: { ...BROWSER_HEADERS, cookie }, cache: "no-store" });
  const crumb = (await r2.text()).trim();
  if (!r2.ok || !crumb || crumb.length > 40) throw new Error("Yahoo: нет crumb");
  crumbCache = { at: Date.now(), cookie, crumb };
  return crumbCache;
}

type YV = { raw?: number; fmt?: string; longFmt?: string } | number | string | undefined;
const fmtYV = (v: YV, pct = false) => {
  if (v == null) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "number") return pct ? `${(v * 100).toFixed(2)}%` : String(v);
  if (v.raw == null && !v.fmt) return undefined;
  if (pct && v.raw != null) return `${(v.raw * 100).toFixed(2)}%`;
  return v.fmt ?? String(v.raw);
};

export async function yahooFundamentals(symbol: string): Promise<Fundamentals> {
  const { cookie, crumb } = await yahooCrumb();
  const modules = "price,summaryDetail,defaultKeyStatistics,financialData,assetProfile,calendarEvents";
  const r = await fetch(
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(crumb)}`,
    { headers: { ...BROWSER_HEADERS, Accept: "application/json", cookie }, cache: "no-store" },
  );
  if (!r.ok) throw new Error(`Yahoo HTTP ${r.status}`);
  const j = (await r.json()) as { quoteSummary: { result?: Record<string, Record<string, YV & object>>[] } };
  const q = j.quoteSummary.result?.[0];
  if (!q) throw new Error("Yahoo: нет данных");
  const sd = q.summaryDetail ?? {};
  const ks = q.defaultKeyStatistics ?? {};
  const fd = q.financialData ?? {};
  const ap = (q.assetProfile ?? {}) as Record<string, YV>;
  const pr = q.price ?? {};
  const ce = (q.calendarEvents ?? {}) as { earnings?: { earningsDate?: YV[] } };
  const f: Record<string, string | undefined> = {
    "Market Cap": fmtYV(pr.marketCap ?? sd.marketCap),
    "P/E": fmtYV(sd.trailingPE),
    "Forward P/E": fmtYV(sd.forwardPE),
    PEG: fmtYV(ks.pegRatio),
    "P/S": fmtYV(sd.priceToSalesTrailing12Months),
    "P/B": fmtYV(ks.priceToBook),
    "EV/EBITDA": fmtYV(ks.enterpriseToEbitda),
    "EV/Sales": fmtYV(ks.enterpriseToRevenue),
    "EPS (ttm)": fmtYV(ks.trailingEps),
    "EPS next Y": fmtYV(ks.forwardEps),
    "EPS Q/Q": fmtYV(fd.earningsGrowth, true),
    "Sales Q/Q": fmtYV(fd.revenueGrowth, true),
    Earnings: fmtYV(ce.earnings?.earningsDate?.[0]),
    ROA: fmtYV(fd.returnOnAssets, true),
    ROE: fmtYV(fd.returnOnEquity, true),
    "Gross Margin": fmtYV(fd.grossMargins, true),
    "Oper. Margin": fmtYV(fd.operatingMargins, true),
    "Profit Margin": fmtYV(fd.profitMargins, true),
    "Debt/Eq": typeof fd.debtToEquity === "object" && fd.debtToEquity.raw != null ? (fd.debtToEquity.raw / 100).toFixed(2) : undefined,
    "Current Ratio": fmtYV(fd.currentRatio),
    "Quick Ratio": fmtYV(fd.quickRatio),
    Sales: fmtYV(fd.totalRevenue),
    Income: fmtYV(ks.netIncomeToCommon),
    "Dividend TTM": sd.trailingAnnualDividendRate ? `${fmtYV(sd.trailingAnnualDividendRate)} (${fmtYV(sd.trailingAnnualDividendYield, true)})` : undefined,
    Payout: fmtYV(sd.payoutRatio, true),
    Beta: fmtYV(sd.beta),
    "Shs Outstand": fmtYV(ks.sharesOutstanding),
    "Shs Float": fmtYV(ks.floatShares),
    "Short Float": fmtYV(ks.shortPercentOfFloat, true),
    "Short Ratio": fmtYV(ks.shortRatio),
    "Insider Own": fmtYV(ks.heldPercentInsiders, true),
    "Inst Own": fmtYV(ks.heldPercentInstitutions, true),
    "Target Price": fmtYV(fd.targetMeanPrice),
    Recom: fmtYV(fd.recommendationMean),
    "Avg Volume": fmtYV(sd.averageVolume),
    "52W High": fmtYV(sd.fiftyTwoWeekHigh),
    "52W Low": fmtYV(sd.fiftyTwoWeekLow),
    Employees: fmtYV(ap.fullTimeEmployees),
  };
  const fields = Object.fromEntries(Object.entries(f).filter(([, v]) => v != null && v !== "")) as Record<string, string>;
  return {
    symbol,
    source: "yahoo",
    name: fmtYV((pr as Record<string, YV>).longName) ?? fmtYV((pr as Record<string, YV>).shortName),
    sector: fmtYV(ap.sector),
    industry: fmtYV(ap.industry),
    country: fmtYV(ap.country),
    fields,
    news: [],
    updatedAt: new Date().toISOString(),
  };
}

/* ───────────── News: ticker + market ───────────── */

export async function yahooTickerNews(symbol: string): Promise<NewsItem[]> {
  const r = await fetchWithTimeout(
    `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=0&newsCount=25&listsCount=0`,
    7000,
  );
  if (!r.ok) throw new Error(`Yahoo HTTP ${r.status}`);
  const j = (await r.json()) as { news?: { uuid: string; title: string; publisher: string; link: string; providerPublishTime: number; relatedTickers?: string[] }[] };
  return (j.news ?? []).map((n) => ({
    id: n.uuid,
    title: n.title,
    url: n.link,
    source: n.publisher,
    time: n.providerPublishTime,
    tickers: n.relatedTickers,
  }));
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

/** Minimal RSS 2.0 reader (title/link/pubDate/source). */
export function parseRss(xml: string, fallbackSource: string): NewsItem[] {
  const out: NewsItem[] = [];
  for (const m of xml.matchAll(/<item\b[\s\S]*?<\/item>/g)) {
    const item = m[0];
    const tag = (name: string) => {
      const r = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`).exec(item);
      return r ? decode(r[1]) : "";
    };
    const title = tag("title");
    const url = tag("link") || tag("guid");
    const t = Date.parse(tag("pubDate"));
    if (!title || !url) continue;
    out.push({ id: hash(url), title, url, source: tag("source") || fallbackSource, time: isFinite(t) ? Math.floor(t / 1000) : Math.floor(Date.now() / 1000) });
  }
  return out;
}

export const MARKET_FEEDS: { url: string; source: string }[] = [
  { url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114", source: "CNBC" },
  { url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664", source: "CNBC Markets" },
  { url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", source: "MarketWatch" },
  { url: "https://finance.yahoo.com/news/rssindex", source: "Yahoo Finance" },
  { url: "https://www.investing.com/rss/news_25.rss", source: "Investing.com" },
  { url: "https://cointelegraph.com/rss", source: "Cointelegraph" },
];

/** Finviz market news page (#news → first table = news, second = blogs). */
export function parseFinvizNewsPage(html: string): NewsItem[] {
  const root = parse(html);
  const news = root.querySelector("#news");
  // innermost tables only — the news/blog lists sit inside layout tables
  const tables = (news?.querySelectorAll("table") ?? []).filter((t) => !t.querySelector("table"));
  const out: NewsItem[] = [];
  const seen = new Set<string>();
  const t0 = nyToday();
  const rowsOf = (t: HTMLElement) => t.querySelectorAll("tr");
  for (const table of tables) {
    for (const row of rowsOf(table)) {
      const cols = row.querySelectorAll("td");
      if (cols.length < 3) continue;
      const a = cols[2].querySelector("a");
      if (!a) continue;
      const stamp = cols[1].text.trim();
      const md = /^([A-Z][a-z]{2})-(\d{2})$/.exec(stamp);
      const t = md
        ? etToUnix(t0.y, MONTHS[md[1]], Number(md[2]), 12, 0)
        : (() => {
            const c = parseClock(stamp);
            return c ? etToUnix(t0.y, t0.mo, t0.d, c.h, c.mi) : Math.floor(Date.now() / 1000);
          })();
      const url = a.getAttribute("href") ?? "";
      if (!/^https?:/.test(url) || seen.has(url)) continue;
      seen.add(url);
      out.push({ id: hash(url), title: decode(a.text), url, source: hostOf(url), time: t });
    }
  }
  return out;
}

let marketCache: { at: number; v: { items: NewsItem[]; sources: string[] } } | null = null;

export async function marketNews(): Promise<{ items: NewsItem[]; sources: string[] }> {
  if (marketCache && Date.now() - marketCache.at < 60_000) return marketCache.v;
  const jobs: Promise<{ src: string; items: NewsItem[] }>[] = [
    getHtml("https://finviz.com/news.ashx").then((h) => ({ src: "Finviz", items: parseFinvizNewsPage(h) })),
    ...MARKET_FEEDS.map((f) =>
      fetchWithTimeout(f.url, 7000, "application/rss+xml, application/xml, text/xml").then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return { src: f.source, items: parseRss(await r.text(), f.source) };
      }),
    ),
  ];
  const res = await Promise.allSettled(jobs);
  const seen = new Set<string>();
  const items: NewsItem[] = [];
  const sources: string[] = [];
  for (const r of res) {
    if (r.status !== "fulfilled" || !r.value.items.length) continue;
    sources.push(r.value.src);
    for (const n of r.value.items) {
      const key = n.title.toLowerCase().replace(/\W+/g, " ").slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(n);
    }
  }
  const now = Date.now() / 1000;
  const v = { items: items.filter((n) => n.time <= now + 600).sort((a, b) => b.time - a.time).slice(0, 120), sources };
  if (items.length) marketCache = { at: Date.now(), v };
  return v;
}
