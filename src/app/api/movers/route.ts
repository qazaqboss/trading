import { connection } from "next/server";
import { fetchScreener } from "@/lib/yahoo";
import type { Mover } from "@/lib/types";

let cache: { at: number; data: Record<string, Mover[]> } | null = null;

export async function GET() {
  await connection();
  if (cache && Date.now() - cache.at < 30_000) return Response.json(cache.data);
  const ids = ["day_gainers", "day_losers", "most_actives"] as const;
  const res = await Promise.allSettled(ids.map((id) => fetchScreener(id)));
  const data: Record<string, Mover[]> = {};
  ids.forEach((id, i) => (data[id] = res[i].status === "fulfilled" ? (res[i] as PromiseFulfilledResult<Mover[]>).value : []));
  if (Object.values(data).some((l) => l.length)) cache = { at: Date.now(), data };
  return Response.json(data);
}
