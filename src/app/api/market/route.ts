import { connection } from "next/server";
import { getMarket } from "@/lib/market";

export async function GET() {
  await connection(); // always run at request time
  const data = await getMarket();
  return Response.json(data, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  });
}
