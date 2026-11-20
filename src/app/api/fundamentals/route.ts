import { connection, type NextRequest } from "next/server";
import { demoFundamentals } from "@/lib/demo-fin";
import { finvizQuote, yahooFundamentals, yahooTickerNews } from "@/lib/finviz";
import { getMarket } from "@/lib/market";
import type { Fundamentals } from "@/lib/types";

const SYMBOL_RE = /^[A-Z0-9.\-]{1,10}$/;

export async function GET(req: NextRequest) {
  await connection();
  const symbol = (req.nextUrl.searchParams.get("symbol") ?? "").trim().toUpperCase();
  if (!SYMBOL_RE.test(symbol)) return Response.json({ error: "Некорректный тикер" }, { status: 400 });
  const errors: string[] = [];
  let data: Fundamentals | null = null;

  if (process.env.MARKET_DEMO !== "1") {
    try {
      data = await finvizQuote(symbol);
    } catch (e) {
      errors.push((e as Error).message);
      try {
        data = await yahooFundamentals(symbol);
        data.news = await yahooTickerNews(symbol).catch(() => []);
      } catch (e2) {
        errors.push((e2 as Error).message);
      }
    }
  }
  if (!data) {
    const market = await getMarket();
    if (market.source !== "demo" && process.env.MARKET_DEMO !== "1")
      return Response.json({ error: `Нет фундаментальных данных по ${symbol}`, errors }, { status: 502 });
    const a = market.assets.find((x) => x.symbol === symbol);
    data = demoFundamentals(symbol, a?.m.price ?? 100, a?.name);
  }
  return Response.json({ ...data, errors }, { headers: { "Cache-Control": "no-store" } });
}
