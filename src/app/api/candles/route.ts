import { connection, type NextRequest } from "next/server";
import { getMarket } from "@/lib/market";
import { demoCandles } from "@/lib/ta";
import { fetchCandles, TF_YAHOO } from "@/lib/yahoo";
import type { CandlesPayload, Timeframe } from "@/lib/types";

const SYMBOL_RE = /^[A-Za-z0-9^=.\-]{1,15}$/;

export async function GET(req: NextRequest) {
  await connection();
  const p = req.nextUrl.searchParams;
  const symbol = (p.get("symbol") ?? "").trim().toUpperCase();
  const tf = (p.get("tf") ?? "5m") as Timeframe;
  const live = p.get("live") === "1";
  if (!SYMBOL_RE.test(symbol) || !(tf in TF_YAHOO)) return Response.json({ error: "Некорректный запрос" }, { status: 400 });

  if (process.env.MARKET_DEMO !== "1") {
    try {
      const { candles, name } = await fetchCandles(symbol, tf, live);
      const body: CandlesPayload = { symbol, tf, name, source: "yahoo", candles };
      return Response.json(body, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      const market = await getMarket();
      if (market.source !== "demo") return Response.json({ error: `Нет свечей по ${symbol}: ${(e as Error).message}` }, { status: 502 });
    }
  }
  // offline demo: synthetic candles anchored to the demo snapshot price
  const market = await getMarket();
  const a = market.assets.find((x) => x.symbol === symbol);
  const body: CandlesPayload = {
    symbol,
    tf,
    name: a?.name,
    source: "demo",
    candles: demoCandles(symbol, tf, a?.m.price ?? 100, a?.m.vol30 ?? 30, live),
  };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
