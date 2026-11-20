import { connection } from "next/server";
import { githubListings, githubNewTickers, ipoCalendar } from "@/lib/ipo";
import type { GhStock, IpoItem } from "@/lib/types";

/** IPO calendar (Nasdaq + Yahoo), this year's listings and tickers added in the last 7 days (GitHub). */
export async function GET() {
  await connection();
  const year = new Date().getUTCFullYear();
  const [cal, gh, fresh] = await Promise.allSettled([ipoCalendar(), githubListings(), githubNewTickers(7)]);
  const errors: string[] = [];

  let calendar: IpoItem[] = [];
  let calendarSources: string[] = [];
  if (cal.status === "fulfilled") {
    calendar = cal.value.items;
    calendarSources = cal.value.sources;
    errors.push(...cal.value.errors);
  } else errors.push(`IPO: ${(cal.reason as Error).message}`);

  let listings: GhStock[] = [];
  if (gh.status === "fulfilled") listings = gh.value;
  else errors.push(`GitHub: ${(gh.reason as Error).message}`);
  const bySym = new Map(listings.map((g) => [g.symbol, g]));

  const thisYear = listings
    .filter((g) => g.ipoYear && g.ipoYear >= year)
    .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
    .slice(0, 300);

  let newTickers: { since: string; added: GhStock[]; removed: string[] } | null = null;
  if (fresh.status === "fulfilled") {
    newTickers = {
      since: fresh.value.since,
      // hide SPAC warrants / units / rights; real companies (largest first) on top
      added: fresh.value.added
        .map((s) => bySym.get(s) ?? { symbol: s, name: "", exchange: "" })
        .filter((g) => !/\b(warrants?|units?|rights?)\b/i.test(g.name))
        .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0)),
      removed: fresh.value.removed,
    };
  } else errors.push(`Новые тикеры: ${(fresh.reason as Error).message}`);

  return Response.json(
    { calendar, calendarSources, thisYear, year, newTickers, errors },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } },
  );
}
