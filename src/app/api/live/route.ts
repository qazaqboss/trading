import { connection, type NextRequest } from "next/server";
import { getMarket } from "@/lib/market";
import { fetchQuotes } from "@/lib/yahoo";
import type { LiveQuote } from "@/lib/types";

const MAX = 120;
const SYMBOL_RE = /^[A-Za-z0-9^=.\-]{1,15}$/;

export async function GET(req: NextRequest) {
  await connection();
  const symbols = [...new Set((req.nextUrl.searchParams.get("symbols") ?? "").split(","))]
    .map((s) => s.trim().toUpperCase())
    .filter((s) => SYMBOL_RE.test(s))
    .slice(0, MAX);
  if (!symbols.length) return Response.json({ source: "live", quotes: [] });

  let quotes: LiveQuote[] = [];
  if (process.env.MARKET_DEMO !== "1") {
    try {
      quotes = await fetchQuotes(symbols);
    } catch {
      quotes = [];
    }
  }
  if (quotes.length) return Response.json({ source: "live", quotes }, { headers: { "Cache-Control": "no-store" } });

  // Offline fallback: small random ticks around the demo snapshot so the UI stays animated.
  const market = await getMarket();
  if (market.source !== "demo") return Response.json({ source: "live", quotes: [] });
  const now = Math.floor(Date.now() / 1000);
  const demo = symbols.flatMap((s) => {
    const a = market.assets.find((x) => x.symbol === s);
    if (!a) return [];
    const prev = a.history[a.history.length - 2]?.c ?? a.m.price;
    const price = a.m.price * (1 + (Math.random() - 0.5) * 0.002);
    return [{ symbol: s, price, prevClose: prev, chPct: (price / prev - 1) * 100, time: now }];
  });
  return Response.json({ source: "demo", quotes: demo }, { headers: { "Cache-Control": "no-store" } });
}
