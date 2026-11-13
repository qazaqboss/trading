import { connection, type NextRequest } from "next/server";
import { evaluate } from "@/lib/ideas";
import { getMarket, toAsset } from "@/lib/market";
import { fetchHistory } from "@/lib/yahoo";
import type { Asset } from "@/lib/types";

const SYMBOL_RE = /^[A-Za-z0-9^=.\-]{1,15}$/;
const cache = new Map<string, { at: number; asset: Asset }>();

export async function GET(req: NextRequest) {
  await connection();
  const symbol = (req.nextUrl.searchParams.get("symbol") ?? "").trim().toUpperCase();
  const name = req.nextUrl.searchParams.get("name") ?? undefined;
  if (!SYMBOL_RE.test(symbol)) return Response.json({ error: "Некорректный тикер" }, { status: 400 });

  // already part of the dashboard snapshot?
  const market = await getMarket();
  const known = market.assets.find((a) => a.symbol === symbol);
  if (known) return Response.json({ asset: known, idea: evaluate(known) });

  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.at < 60_000) return Response.json({ asset: hit.asset, idea: evaluate(hit.asset) });
  try {
    const { bars, name: yName } = await fetchHistory(symbol);
    const asset = toAsset({ symbol, ticker: symbol, name: name || yName || symbol, cls: "stock" }, bars);
    cache.set(symbol, { at: Date.now(), asset });
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    return Response.json({ asset, idea: evaluate(asset) });
  } catch (e) {
    return Response.json({ error: `Нет данных по ${symbol}: ${(e as Error).message}` }, { status: 502 });
  }
}
