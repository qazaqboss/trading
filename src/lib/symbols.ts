import "server-only";
import { STOCKS } from "./assets";
import { githubListings } from "./ipo";
import { fetchWithTimeout } from "./yahoo";

/** Compact row: [yahooSymbol, name, exchange, isEtf (1/0), marketCap?, ipoYear?, sector?] */
export type SymbolRow = [string, string, string, 0 | 1, number?, number?, string?];

const EXCH: Record<string, string> = { N: "NYSE", A: "NYSE American", P: "NYSE Arca", Z: "Cboe", V: "IEX", Q: "Nasdaq" };
const SKIP_NAME = /\b(warrants?|units?|rights?|notes? due|debentures?|preferred|depositary shares? each representing a 1\/)\b/i;
const TTL = 12 * 60 * 60 * 1000;

let cache: { at: number; rows: SymbolRow[] } | null = null;
let cacheSource = "fallback";

function cleanName(s: string): string {
  return s
    .replace(/\s+-\s+(Class [A-Z] )?(Common Stock|Ordinary Shares|Common Shares|American Depositary Shares).*$/i, (m, cls) =>
      cls ? ` (${cls.trim()})` : "",
    )
    .replace(/\s+Common Stock$/i, "")
    .trim();
}

function parse(text: string, kind: "nasdaq" | "other"): SymbolRow[] {
  const lines = text.split(/\r?\n/);
  const header = lines[0].split("|");
  const col = (name: string) => header.indexOf(name);
  const iSym = kind === "nasdaq" ? col("Symbol") : col("ACT Symbol");
  const iName = col("Security Name");
  const iEtf = col("ETF");
  const iTest = col("Test Issue");
  const iEx = col("Exchange");
  const rows: SymbolRow[] = [];
  for (const line of lines.slice(1)) {
    if (!line || line.startsWith("File Creation Time")) continue;
    const f = line.split("|");
    const sym = f[iSym];
    const name = f[iName] ?? "";
    if (!sym || f[iTest] === "Y" || /[$^]/.test(sym) || SKIP_NAME.test(name)) continue;
    rows.push([sym.replace(/\./g, "-"), cleanName(name), kind === "nasdaq" ? "Nasdaq" : EXCH[f[iEx]] ?? f[iEx], f[iEtf] === "Y" ? 1 : 0]);
  }
  return rows;
}

const FALLBACK: SymbolRow[] = STOCKS.map((s) => [s.symbol, s.name, "US", 0]);

async function nasdaqTrader(): Promise<SymbolRow[]> {
  const base = "https://www.nasdaqtrader.com/dynamic/SymDir";
  const [a, b] = await Promise.all([
    fetchWithTimeout(`${base}/nasdaqlisted.txt`, 10000, "text/plain"),
    fetchWithTimeout(`${base}/otherlisted.txt`, 10000, "text/plain"),
  ]);
  if (!a.ok || !b.ok) throw new Error(`HTTP ${a.status}/${b.status}`);
  const rows = [...parse(await a.text(), "nasdaq"), ...parse(await b.text(), "other")];
  if (rows.length < 1000) throw new Error("слишком короткий список");
  return rows;
}

/**
 * Every security listed on US exchanges: Nasdaq Trader symbol directory (incl. ETFs) merged with the
 * nightly GitHub snapshot rreichel3/US-Stock-Symbols (adds market cap, IPO year, sector and catches
 * listings either source is missing). Refreshed every 6–12 h, so new tickers appear automatically.
 */
export async function getUsSymbols(): Promise<{ rows: SymbolRow[]; source: string }> {
  if (cache && Date.now() - cache.at < TTL) return { rows: cache.rows, source: cacheSource };
  const [nt, gh] = await Promise.allSettled([nasdaqTrader(), githubListings()]);
  const map = new Map<string, SymbolRow>();
  const sources: string[] = [];
  if (nt.status === "fulfilled") {
    sources.push("nasdaqtrader");
    for (const r of nt.value) if (!map.has(r[0])) map.set(r[0], r);
  }
  if (gh.status === "fulfilled") {
    sources.push("github");
    for (const g of gh.value) {
      const cur = map.get(g.symbol);
      if (cur) map.set(g.symbol, [cur[0], cur[1], cur[2], cur[3], g.marketCap, g.ipoYear, g.sector]);
      else if (!SKIP_NAME.test(g.name)) map.set(g.symbol, [g.symbol, g.name, g.exchange, 0, g.marketCap, g.ipoYear, g.sector]);
    }
  }
  if (!map.size) return { rows: cache?.rows ?? FALLBACK, source: cache ? cacheSource : "fallback" };
  const rows = [...map.values()].sort((x, y) => x[0].localeCompare(y[0]));
  cache = { at: Date.now(), rows };
  cacheSource = sources.join("+");
  return { rows, source: cacheSource };
}

export { parse as parseSymbolDirectory };
