import { connection, type NextRequest } from "next/server";
import { ALL_ASSETS } from "@/lib/assets";
import { nasdaqQuote } from "@/lib/ipo";
import { getMarket } from "@/lib/market";
import { usSessionAt } from "@/lib/ta";
import { fetchQuotes, mapLimit } from "@/lib/yahoo";
import type { LiveQuote } from "@/lib/types";

/**
 * Compact quotes for home-screen widgets (Scriptable on iOS, or anything else):
 * GET /api/widget?symbols=^GSPC,BTC-USD,NVDA  →  { items: [{ symbol, label, price, chPct, spark }], session, updatedAt }
 */
const SYMBOL_RE = /^[A-Z0-9^=.\-]{1,15}$/;
const LABELS: Record<string, string> = Object.fromEntries(ALL_ASSETS.map((a) => [a.symbol, a.cls === "stock" ? a.ticker : a.ticker.replace("S&P 500", "S&P")]));
const label = (s: string) => LABELS[s] ?? s.replace(/-USD$/, "");

const shrink = (xs: number[] | undefined, n = 32) => {
  if (!xs || xs.length <= n) return xs ?? [];
  const step = (xs.length - 1) / (n - 1);
  return Array.from({ length: n }, (_, i) => xs[Math.round(i * step)]);
};
const round = (v: number) => Number(v.toPrecision(7));

export async function GET(req: NextRequest) {
  await connection();
  const symbols = [...new Set((req.nextUrl.searchParams.get("symbols") ?? "^GSPC,BTC-USD,GC=F").split(","))]
    .map((s) => s.trim().toUpperCase())
    .filter((s) => SYMBOL_RE.test(s))
    .slice(0, 12);

  let quotes: LiveQuote[] = [];
  let source = "live";
  if (process.env.MARKET_DEMO !== "1") {
    quotes = await fetchQuotes(symbols).catch(() => []);
    const have = new Set(quotes.map((q) => q.symbol));
    const missing = symbols.filter((s) => !have.has(s) && /^[A-Z]{1,5}(-[A-Z])?$/.test(s));
    if (quotes.length && missing.length) {
      const extra = await mapLimit(missing, 4, (s) => nasdaqQuote(s));
      extra.forEach((r) => r.status === "fulfilled" && r.value && quotes.push(r.value));
    }
  }
  if (!quotes.length) {
    const market = await getMarket();
    if (market.source === "demo" || process.env.MARKET_DEMO === "1") {
      source = "demo";
      quotes = symbols.flatMap((s) => {
        const a = market.assets.find((x) => x.symbol === s);
        if (!a) return [];
        const prev = a.history[a.history.length - 2]?.c ?? a.m.price;
        return [{ symbol: s, price: a.m.price, prevClose: prev, chPct: (a.m.price / prev - 1) * 100, time: 0, spark: a.history.slice(-30).map((b) => b.c) }];
      });
    }
  }

  const by = new Map(quotes.map((q) => [q.symbol, q]));
  const items = symbols
    .map((s) => by.get(s))
    .filter((q): q is LiveQuote => !!q)
    .map((q) => ({ symbol: q.symbol, label: label(q.symbol), price: round(q.price), chPct: Math.round(q.chPct * 100) / 100, spark: shrink(q.spark).map(round) }));

  return Response.json(
    { items, source, session: usSessionAt(Math.floor(Date.now() / 1000)), updatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60", "Access-Control-Allow-Origin": "*" } },
  );
}
