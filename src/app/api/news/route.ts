import { connection, type NextRequest } from "next/server";
import { demoNews } from "@/lib/demo-fin";
import { finvizQuote, marketNews, yahooTickerNews } from "@/lib/finviz";
import { getMarket } from "@/lib/market";
import type { NewsItem } from "@/lib/types";

const SYMBOL_RE = /^[A-Z0-9^=.\-]{1,15}$/;

export async function GET(req: NextRequest) {
  await connection();
  const symbol = (req.nextUrl.searchParams.get("symbol") ?? "").trim().toUpperCase();
  if (symbol && !SYMBOL_RE.test(symbol)) return Response.json({ error: "Некорректный тикер" }, { status: 400 });
  let items: NewsItem[] = [];
  let sources: string[] = [];

  if (process.env.MARKET_DEMO !== "1") {
    if (symbol) {
      // plain US tickers → Finviz first; indices, crypto, futures → Yahoo
      if (/^[A-Z.\-]{1,6}$/.test(symbol) && !symbol.endsWith("-USD")) {
        try {
          items = (await finvizQuote(symbol)).news;
          sources = ["Finviz"];
        } catch {
          /* fall through */
        }
      }
      if (!items.length) {
        items = await yahooTickerNews(symbol).catch(() => []);
        sources = items.length ? ["Yahoo Finance"] : [];
      }
    } else {
      ({ items, sources } = await marketNews());
    }
  }
  if (!items.length) {
    const market = await getMarket();
    if (market.source === "demo" || process.env.MARKET_DEMO === "1") return Response.json({ items: demoNews(symbol || undefined), sources: ["demo"] });
  }
  return Response.json({ items, sources }, { headers: { "Cache-Control": "no-store" } });
}
