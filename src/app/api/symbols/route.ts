import { connection } from "next/server";
import { getUsSymbols } from "@/lib/symbols";

export async function GET() {
  await connection();
  const { rows, source } = await getUsSymbols();
  return Response.json(
    { source, count: rows.length, rows },
    { headers: { "Cache-Control": source === "fallback" ? "no-store" : "public, s-maxage=43200, stale-while-revalidate=86400" } },
  );
}
