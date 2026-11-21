"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtBig, fmtNum, fmtPct, fmtPrice, upDown } from "@/lib/format";
import { useLiveQuotes } from "@/lib/live";
import type { GhStock, IpoItem } from "@/lib/types";
import { Change, LivePrice, Pill, SectionTitle, Segmented } from "./ui";

interface IpoPayload {
  calendar: IpoItem[];
  calendarSources: string[];
  thisYear: GhStock[];
  year: number;
  newTickers: { since: string; added: GhStock[]; removed: string[] } | null;
  errors: string[];
}

type Tab = "upcoming" | "priced" | "filed" | "new" | "year";

const daysTo = (d?: string) => (d ? Math.round((Date.parse(`${d}T12:00:00Z`) - Date.now()) / 86400_000) : NaN);
const fmtDay = (d?: string) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "—");
const rangeTxt = (i: IpoItem) =>
  i.priceLow ? `$${fmtNum(i.priceLow, 2)}${i.priceHigh && i.priceHigh !== i.priceLow ? `–${fmtNum(i.priceHigh, 2)}` : ""}` : "—";

export default function IpoPanel({ onOpen }: { onOpen: (symbol: string, name?: string) => void }) {
  const [data, setData] = useState<IpoPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/ipo")
        .then((r) => r.json() as Promise<IpoPayload>)
        .then((j) => alive && (setData(j), setErr(null)))
        .catch((e) => alive && setErr((e as Error).message));
    const t = setTimeout(load, 0);
    const iv = setInterval(load, 10 * 60_000);
    return () => {
      alive = false;
      clearTimeout(t);
      clearInterval(iv);
    };
  }, []);

  const lists = useMemo(() => {
    const cal = data?.calendar ?? [];
    const today = new Date().toISOString().slice(0, 10);
    return {
      upcoming: cal.filter((i) => i.status === "upcoming" && (!i.date || i.date >= today)).sort((a, b) => (a.date ?? "9").localeCompare(b.date ?? "9")),
      priced: cal.filter((i) => i.status === "priced").sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
      filed: cal.filter((i) => i.status === "filed").sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
      fresh: data?.newTickers?.added ?? [],
      year: data?.thisYear ?? [],
    };
  }, [data]);

  const active: Tab = tab ?? (lists.upcoming.length ? "upcoming" : lists.fresh.length ? "new" : "year");
  const limit = all ? 300 : 12;

  // live prices for whatever tickers are on screen
  const visibleSymbols = useMemo(() => {
    const s =
      active === "priced" ? lists.priced.map((i) => i.symbol) : active === "new" ? lists.fresh.map((g) => g.symbol) : active === "year" ? lists.year.map((g) => g.symbol) : [];
    return s.filter((x): x is string => !!x).slice(0, limit).slice(0, 60);
  }, [active, lists, limit]);
  const { quotes } = useLiveQuotes(visibleSymbols, 15_000, visibleSymbols.length > 0);

  const count = (t: Tab) => ({ upcoming: lists.upcoming.length, priced: lists.priced.length, filed: lists.filed.length, new: lists.fresh.length, year: lists.year.length })[t];
  const tabs: { value: Tab; label: string }[] = [
    { value: "upcoming", label: `Ближайшие (${count("upcoming")})` },
    { value: "priced", label: `Состоялись (${count("priced")})` },
    { value: "filed", label: `Заявки (${count("filed")})` },
    { value: "new", label: `Новые тикеры (${count("new")})` },
    { value: "year", label: `IPO ${data?.year ?? ""}` },
  ];
  const total = count(active);

  return (
    <section className="card p-5">
      <SectionTitle
        title="IPO и новые тикеры"
        subtitle={
          data
            ? `Календарь: ${data.calendarSources.join(" + ") || "недоступен"} · листинги: GitHub rreichel3/US-Stock-Symbols (обновляется каждую ночь)${data.newTickers ? ` · новые с ${fmtDay(data.newTickers.since)}` : ""}`
            : "Загрузка…"
        }
        right={<Segmented value={active} onChange={(v) => (setTab(v), setAll(false))} options={tabs} />}
      />
      {err && !data && <p className="text-xs text-down">Ошибка: {err}</p>}
      {!data ? (
        <p className="py-6 text-center text-sm text-muted">&gt; загрузка календаря IPO…</p>
      ) : total === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          {active === "upcoming" || active === "priced" || active === "filed"
            ? `Календарь IPO сейчас недоступен${data.errors.length ? ` (${data.errors[0]})` : ""}. Вкладки «Новые тикеры» и «IPO ${data.year}» работают от GitHub.`
            : "Нет данных."}
        </p>
      ) : (
        <div className="sm:overflow-x-auto">
          <table className="w-full text-sm sm:min-w-[760px]">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-line">
                {active === "upcoming" || active === "priced" || active === "filed" ? (
                  <>
                    <th className="px-2 py-2 font-medium">Дата</th>
                    <th className="px-2 py-2 font-medium">Тикер</th>
                    <th className="px-2 py-2 font-medium hidden sm:table-cell">Компания</th>
                    <th className="px-2 py-2 font-medium hidden sm:table-cell">Биржа</th>
                    <th className="px-2 py-2 text-right font-medium">{active === "priced" ? "Цена IPO" : "Диапазон"}</th>
                    {active === "priced" && <th className="px-2 py-2 text-right font-medium">Сейчас</th>}
                    {active === "priced" && <th className="px-2 py-2 text-right font-medium">От цены IPO</th>}
                    <th className="px-2 py-2 text-right font-medium hidden sm:table-cell">Акций</th>
                    <th className="px-2 py-2 text-right font-medium hidden sm:table-cell">Объём сделки</th>
                  </>
                ) : (
                  <>
                    <th className="px-2 py-2 font-medium">Тикер</th>
                    <th className="px-2 py-2 font-medium hidden sm:table-cell">Компания</th>
                    <th className="px-2 py-2 font-medium hidden sm:table-cell">Биржа</th>
                    <th className="px-2 py-2 font-medium hidden sm:table-cell">Сектор</th>
                    <th className="px-2 py-2 text-right font-medium">Цена</th>
                    <th className="px-2 py-2 text-right font-medium">Изм.</th>
                    <th className="px-2 py-2 text-right font-medium hidden sm:table-cell">Капитализация</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {(active === "upcoming" ? lists.upcoming : active === "priced" ? lists.priced : active === "filed" ? lists.filed : [])
                .slice(0, limit)
                .map((i, k) => {
                  const q = i.symbol ? quotes[i.symbol] : undefined;
                  const since = q && i.price ? (q.price / i.price - 1) * 100 : NaN;
                  const dd = daysTo(i.date);
                  return (
                    <tr
                      key={`${i.symbol ?? i.company}-${k}`}
                      onClick={() => i.symbol && active === "priced" && onOpen(i.symbol, i.company)}
                      className={`border-b border-line/50 ${i.symbol && active === "priced" ? "cursor-pointer hover:bg-white/[0.03]" : ""}`}
                    >
                      <td className="tnum px-2 py-2 whitespace-nowrap">
                        {fmtDay(i.date)}
                        {active === "upcoming" && isFinite(dd) && (
                          <span className={`block text-[11px] sm:ml-1.5 sm:inline ${dd <= 3 ? "text-warn" : "text-faint"}`}>{dd <= 0 ? "сегодня" : `через ${dd} дн.`}</span>
                        )}
                      </td>
                      <td className="px-2 font-semibold text-brand">
                        {i.symbol ?? "—"}
                        <div className="max-w-[120px] truncate text-[11px] font-normal text-faint sm:hidden">{i.company}</div>
                      </td>
                      <td className="max-w-[260px] truncate px-2 text-ink hidden sm:table-cell">{i.company}</td>
                      <td className="px-2 text-xs text-faint hidden sm:table-cell">{i.exchange ?? "—"}</td>
                      <td className="tnum px-2 text-right">{active === "priced" ? (i.price ? `$${fmtNum(i.price, 2)}` : "—") : rangeTxt(i)}</td>
                      {active === "priced" && <td className="px-2 text-right">{q ? <LivePrice value={q.price} /> : <span className="text-faint">…</span>}</td>}
                      {active === "priced" && <td className={`tnum px-2 text-right ${upDown(since)}`}>{isFinite(since) ? fmtPct(since, 1) : "—"}</td>}
                      <td className="tnum px-2 text-right text-muted hidden sm:table-cell">{i.shares ? fmtBig(i.shares) : "—"}</td>
                      <td className="tnum px-2 text-right text-muted hidden sm:table-cell">{i.dealSize ? fmtBig(i.dealSize, "$") : i.shares && (i.priceHigh ?? i.price) ? fmtBig(i.shares * (i.priceHigh ?? i.price ?? 0), "$") : "—"}</td>
                    </tr>
                  );
                })}
              {(active === "new" ? lists.fresh : active === "year" ? lists.year : []).slice(0, limit).map((g) => {
                const q = quotes[g.symbol];
                return (
                  <tr key={g.symbol} onClick={() => onOpen(g.symbol, g.name)} className="cursor-pointer border-b border-line/50 hover:bg-white/[0.03]">
                    <td className="px-2 py-2 font-semibold text-brand">
                      {g.symbol}
                      {g.ipoYear && data.year && g.ipoYear >= data.year && <span className="ml-1.5 text-[10px] text-warn">IPO {g.ipoYear}</span>}
                      <div className="max-w-[160px] truncate text-[11px] font-normal text-faint sm:hidden">{g.name}</div>
                    </td>
                    <td className="max-w-[280px] truncate px-2 text-ink hidden sm:table-cell">{g.name || "—"}</td>
                    <td className="px-2 text-xs text-faint hidden sm:table-cell">{g.exchange || "—"}</td>
                    <td className="max-w-[160px] truncate px-2 text-xs text-muted hidden sm:table-cell">{g.sector ?? "—"}</td>
                    <td className="px-2 text-right">{q ? <LivePrice value={q.price} /> : g.last ? <span className="tnum">{fmtPrice(g.last)}</span> : "—"}</td>
                    <td className="px-2 text-right">{q ? <Change v={q.chPct} /> : g.pct != null ? <Change v={g.pct} /> : "—"}</td>
                    <td className="tnum px-2 text-right text-muted hidden sm:table-cell">{g.marketCap ? fmtBig(g.marketCap, "$") : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {data && total > 12 && (
        <div className="mt-2 text-center">
          <button onClick={() => setAll((v) => !v)} className="text-xs text-brand hover:text-ink">
            {all ? "Свернуть" : `Показать все (${Math.min(total, 300)})`}
          </button>
        </div>
      )}
      {data?.newTickers && active === "new" && data.newTickers.removed.length > 0 && (
        <p className="mt-2 text-[11px] text-faint">
          Исключены из листинга за неделю: <Pill>{data.newTickers.removed.length}</Pill> {data.newTickers.removed.slice(0, 20).join(", ")}
          {data.newTickers.removed.length > 20 ? "…" : ""}
        </p>
      )}
    </section>
  );
}
