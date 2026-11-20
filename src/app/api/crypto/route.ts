import { connection, type NextRequest } from "next/server";
import { demoCrypto } from "@/lib/crypto-demo";
import { getMarket } from "@/lib/market";
import { fetchWithTimeout } from "@/lib/yahoo";

/** Server-side CoinGecko proxy with a shared cache (used when the browser hits CoinGecko's rate limit). */
const ALLOWED = [/^coins\/markets$/, /^global$/, /^search$/, /^search\/trending$/, /^coins\/[a-z0-9-]{1,80}$/, /^coins\/[a-z0-9-]{1,80}\/ohlc$/];
const PARAMS = new Set(["vs_currency", "order", "per_page", "page", "sparkline", "price_change_percentage", "category", "ids", "query", "days", "localization", "tickers", "market_data", "community_data", "developer_data"]);
const TTL: [RegExp, number][] = [[/ohlc$/, 300_000], [/^search\/trending$/, 300_000], [/^global$/, 120_000]];
const cache = new Map<string, { at: number; body: unknown }>();

export async function GET(req: NextRequest) {
  await connection();
  const sp = req.nextUrl.searchParams;
  const ep = sp.get("ep") ?? "";
  if (!ALLOWED.some((r) => r.test(ep))) return Response.json({ error: "Недопустимый запрос" }, { status: 400 });
  const params = new URLSearchParams();
  for (const [k, v] of sp) if (PARAMS.has(k) && v.length < 2000) params.set(k, v);
  const key = `${ep}?${params}`;
  const ttl = TTL.find(([r]) => r.test(ep))?.[1] ?? 60_000;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return Response.json(hit.body);

  if (process.env.MARKET_DEMO !== "1") {
    try {
      const r = await fetchWithTimeout(`https://api.coingecko.com/api/v3/${ep}?${params}`, 10000);
      if (r.ok) {
        const body = await r.json();
        cache.set(key, { at: Date.now(), body });
        if (cache.size > 1000) cache.delete(cache.keys().next().value!);
        return Response.json(body);
      }
      if (hit) return Response.json(hit.body); // stale is better than nothing on 429
      if ((await getMarket()).source !== "demo") return Response.json({ error: `CoinGecko HTTP ${r.status}` }, { status: 502 });
    } catch (e) {
      if (hit) return Response.json(hit.body);
      if ((await getMarket()).source !== "demo") return Response.json({ error: `CoinGecko: ${(e as Error).message}` }, { status: 502 });
    }
  }
  const demo = demoCrypto(ep, params);
  if (demo == null) return Response.json({ error: "Монета не найдена" }, { status: 404 });
  return Response.json(demo, { headers: { "x-demo": "1" } });
}
