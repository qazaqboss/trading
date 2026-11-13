import { connection, type NextRequest } from "next/server";
import { searchSymbols } from "@/lib/yahoo";

export async function GET(req: NextRequest) {
  await connection();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 40);
  if (!q) return Response.json({ results: [] });
  try {
    return Response.json({ results: await searchSymbols(q) });
  } catch {
    return Response.json({ results: [] });
  }
}
