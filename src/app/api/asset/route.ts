import { connection, type NextRequest } from "next/server";
import { evaluate } from "@/lib/ideas";
import { getMarket, toAsset } from "@/lib/market";
import { githubListings, ipoCalendar, nasdaqHistory } from "@/lib/ipo";
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
    const { bars, name: yName } = await fetchHistory(symbol).catch(async (e) => {
      // brand-new listings often reach Nasdaq before Yahoo
      try {
        const n = await nasdaqHistory(symbol);
        const gh = (await githubListings().catch(() => [])).find((g) => g.symbol === symbol);
        return { bars: n.bars, name: gh?.name };
      } catch {
        throw e;
      }
    });
    const asset = toAsset({ symbol, ticker: symbol, name: name || yName || symbol, cls: "stock" }, bars);
    cache.set(symbol, { at: Date.now(), asset });
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    return Response.json({ asset, idea: evaluate(asset) });
  } catch (e) {
    // not trading yet? tell the user about the IPO instead of a bare error
    const ipo = (await ipoCalendar().catch(() => ({ items: [] }))).items.find((i) => i.symbol?.toUpperCase() === symbol);
    const range = ipo?.priceLow ? ` · $${ipo.priceLow}${ipo.priceHigh && ipo.priceHigh !== ipo.priceLow ? `–${ipo.priceHigh}` : ""}` : "";
    const msg = ipo
      ? `${symbol} ещё не торгуется: IPO ${ipo.company}${ipo.date ? ` · ${ipo.status === "filed" ? "заявка" : "дата"} ${ipo.date}` : ""}${range}`
      : `Нет данных по ${symbol}: ${(e as Error).message}. Если это новая компания — смотрите раздел «IPO и новые тикеры».`;
    return Response.json({ error: msg, ipo }, { status: 502 });
  }
}
