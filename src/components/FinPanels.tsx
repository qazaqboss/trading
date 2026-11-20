"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fmtPct, fmtPrice } from "@/lib/format";
import type { Fundamentals, NewsItem } from "@/lib/types";
import { Pill, SectionTitle } from "./ui";

/* ───────────── data hooks ───────────── */

export function useFundamentals(symbol: string | null) {
  const [data, setData] = useState<(Fundamentals & { errors?: string[] }) | null>(null);
  const [state, setState] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  useEffect(() => {
    if (!symbol) return;
    let alive = true;
    const load = async (first: boolean) => {
      if (first) setState({ loading: true, error: null });
      try {
        const r = await fetch(`/api/fundamentals?symbol=${encodeURIComponent(symbol)}`);
        const j = await r.json();
        if (!alive) return;
        if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        setData(j);
        setState({ loading: false, error: null });
      } catch (e) {
        if (alive) setState({ loading: false, error: (e as Error).message });
      }
    };
    const t = setTimeout(() => {
      setData(null);
      load(true);
    }, 0);
    const id = setInterval(() => load(false), 5 * 60_000);
    return () => {
      alive = false;
      clearTimeout(t);
      clearInterval(id);
    };
  }, [symbol]);
  return { data, ...state };
}

/** Polls news; ids that appear after the first load are reported as fresh. */
export function useNews(symbol: string | null, intervalMs = 60_000, enabled = true) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    known.current = null;
    const load = async () => {
      if (document.visibilityState !== "visible" && known.current) return;
      try {
        const r = await fetch(`/api/news${symbol ? `?symbol=${encodeURIComponent(symbol)}` : ""}`, { cache: "no-store" });
        const j = (await r.json()) as { items?: NewsItem[]; sources?: string[] };
        if (!alive || !j.items) return;
        const list = j.items;
        if (known.current) {
          const k = known.current;
          const add = list.filter((n) => !k.has(n.id)).map((n) => n.id);
          if (add.length) setFresh((f) => new Set([...f, ...add]));
        }
        known.current = new Set(list.map((n) => n.id));
        setItems(list);
        setSources(j.sources ?? []);
      } catch {
        /* keep previous list */
      } finally {
        if (alive) setLoading(false);
      }
    };
    const t = setTimeout(() => {
      setItems([]);
      setFresh(new Set());
      setLoading(true);
      load();
    }, 0);
    const id = setInterval(load, intervalMs);
    return () => {
      alive = false;
      clearTimeout(t);
      clearInterval(id);
    };
  }, [symbol, intervalMs, enabled]);

  return { items, sources, fresh, loading };
}

/* ───────────── helpers ───────────── */

function useNowMinute() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, []);
  return now;
}

function ago(t: number, now: number | null): string {
  if (!now) return "";
  const s = Math.max(0, Math.floor(now / 1000 - t));
  if (s < 60) return "только что";
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`;
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`;
  return new Date(t * 1000).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const num = (v?: string) => {
  if (!v) return NaN;
  const m = /-?\d+(\.\d+)?/.exec(v.replace(/,/g, ""));
  return m ? Number(m[0]) : NaN;
};

/* ───────────── news list ───────────── */

export function NewsList({ items, fresh, limit, dense = false }: { items: NewsItem[]; fresh?: Set<string>; limit?: number; dense?: boolean }) {
  const now = useNowMinute();
  const list = limit ? items.slice(0, limit) : items;
  return (
    <ul className="divide-y divide-line/60">
      {list.map((n) => (
        <li key={n.id} className={dense ? "py-1.5" : "py-2.5"}>
          <a href={n.url} target="_blank" rel="noreferrer noopener" className="group block">
            <div className="flex items-start gap-2">
              {fresh?.has(n.id) && <span className="mt-0.5 shrink-0 bg-neon-pink px-1 text-[9px] font-bold text-black">NEW</span>}
              <span className={`${dense ? "text-xs" : "text-sm"} leading-snug text-ink group-hover:text-brand`}>{n.title}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-faint">
              <span className="text-neon-pink/80">{n.source}</span>
              <span>{ago(n.time, now)}</span>
              {n.tickers?.slice(0, 4).map((t) => (
                <span key={t} className="text-brand/70">${t}</span>
              ))}
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}

/* ───────────── market news feed ───────────── */

export function MarketNewsPanel() {
  const { items, sources, fresh, loading } = useNews(null, 60_000);
  const [q, setQ] = useState("");
  const [src, setSrc] = useState<string>("all");
  const [more, setMore] = useState(false);
  const allSources = useMemo(() => [...new Set(items.map((n) => n.source))].slice(0, 12), [items]);
  const filtered = items.filter((n) => (src === "all" || n.source === src) && (!q || n.title.toLowerCase().includes(q.toLowerCase())));
  return (
    <section className="card p-5">
      <SectionTitle
        title="Новости рынка · онлайн"
        subtitle={`Обновление каждую минуту${sources.length ? ` · ${sources.join(", ")}` : ""}`}
        right={
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Фильтр: Fed, NVDA, gold…"
            className="w-48 border border-brand/40 bg-black/30 px-2 py-1 text-xs outline-none placeholder:text-faint focus:border-brand"
          />
        }
      />
      <div className="mb-2 flex flex-wrap gap-1">
        {["all", ...allSources].map((s) => (
          <button
            key={s}
            onClick={() => setSrc(s)}
            className={`border px-2 py-0.5 text-[11px] ${src === s ? "border-brand bg-brand/15 text-brand" : "border-line text-faint hover:text-muted"}`}
          >
            {s === "all" ? "Все источники" : s}
          </button>
        ))}
      </div>
      {loading && !items.length ? (
        <p className="py-6 text-center text-sm text-muted">&gt; загрузка ленты…</p>
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Новостей не найдено.</p>
      ) : (
        <div className={`scroll-thin overflow-y-auto pr-1 ${more ? "max-h-[900px]" : ""}`}>
          <NewsList items={filtered} fresh={fresh} limit={more ? 120 : 12} />
        </div>
      )}
      {filtered.length > 12 && (
        <div className="mt-2 text-center">
          <button onClick={() => setMore((m) => !m)} className="text-xs text-brand hover:text-ink">
            {more ? "Свернуть" : `Показать все (${filtered.length})`}
          </button>
        </div>
      )}
    </section>
  );
}

export function TickerNewsPanel({ symbol, dense = false, maxH = "max-h-[520px]" }: { symbol: string; dense?: boolean; maxH?: string }) {
  const { items, sources, fresh, loading } = useNews(symbol, 60_000);
  return (
    <section className="card p-5">
      <SectionTitle title={`Новости ${symbol.replace("-USD", "")}`} subtitle={`Онлайн · ${sources.join(", ") || "Finviz / Yahoo"}`} />
      {loading && !items.length ? (
        <p className="py-4 text-center text-xs text-muted">&gt; загрузка…</p>
      ) : items.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted">Новостей нет.</p>
      ) : (
        <div className={`scroll-thin overflow-y-auto pr-1 ${maxH}`}>
          <NewsList items={items} fresh={fresh} dense={dense} />
        </div>
      )}
    </section>
  );
}

/* ───────────── fundamentals (Finviz snapshot) ───────────── */

type Row = { keys: string[]; ru: string; tone?: "growth" };
const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: "Оценка",
    rows: [
      { keys: ["Market Cap"], ru: "Капитализация" },
      { keys: ["P/E"], ru: "P/E" },
      { keys: ["Forward P/E"], ru: "Форвардный P/E" },
      { keys: ["PEG"], ru: "PEG" },
      { keys: ["P/S"], ru: "P/S (к выручке)" },
      { keys: ["P/B"], ru: "P/B (к капиталу)" },
      { keys: ["P/C"], ru: "P/C (к кэшу)" },
      { keys: ["P/FCF"], ru: "P/FCF" },
      { keys: ["EV/EBITDA"], ru: "EV/EBITDA" },
      { keys: ["EV/Sales"], ru: "EV/Sales" },
    ],
  },
  {
    title: "Прибыль и рост",
    rows: [
      { keys: ["EPS (ttm)"], ru: "EPS за 12 мес." },
      { keys: ["EPS next Q"], ru: "EPS прогноз квартал" },
      { keys: ["EPS next Y"], ru: "EPS прогноз год" },
      { keys: ["EPS this Y"], ru: "Рост EPS в этом году", tone: "growth" },
      { keys: ["EPS next Y %"], ru: "Рост EPS след. год", tone: "growth" },
      { keys: ["EPS next 5Y"], ru: "Рост EPS 5 лет (прогн.)", tone: "growth" },
      { keys: ["EPS past 5Y", "EPS past 3/5Y"], ru: "Рост EPS за 5 лет", tone: "growth" },
      { keys: ["Sales past 5Y", "Sales past 3/5Y"], ru: "Рост выручки за 5 лет", tone: "growth" },
      { keys: ["EPS Q/Q"], ru: "EPS кв/кв", tone: "growth" },
      { keys: ["Sales Q/Q"], ru: "Выручка кв/кв", tone: "growth" },
      { keys: ["Sales"], ru: "Выручка" },
      { keys: ["Income"], ru: "Чистая прибыль" },
      { keys: ["Earnings"], ru: "Дата отчёта" },
    ],
  },
  {
    title: "Рентабельность",
    rows: [
      { keys: ["ROA"], ru: "ROA", tone: "growth" },
      { keys: ["ROE"], ru: "ROE", tone: "growth" },
      { keys: ["ROIC", "ROI"], ru: "ROIC", tone: "growth" },
      { keys: ["Gross Margin"], ru: "Валовая маржа", tone: "growth" },
      { keys: ["Oper. Margin"], ru: "Операционная маржа", tone: "growth" },
      { keys: ["Profit Margin"], ru: "Чистая маржа", tone: "growth" },
    ],
  },
  {
    title: "Баланс и дивиденды",
    rows: [
      { keys: ["Debt/Eq"], ru: "Долг / капитал" },
      { keys: ["LT Debt/Eq"], ru: "Долгоср. долг / капитал" },
      { keys: ["Current Ratio"], ru: "Текущая ликвидность" },
      { keys: ["Quick Ratio"], ru: "Быстрая ликвидность" },
      { keys: ["Book/sh"], ru: "Капитал на акцию" },
      { keys: ["Cash/sh"], ru: "Кэш на акцию" },
      { keys: ["Dividend TTM", "Dividend", "Dividend %"], ru: "Дивиденд (12 мес.)" },
      { keys: ["Dividend Est."], ru: "Дивиденд (прогноз)" },
      { keys: ["Payout"], ru: "Доля выплат" },
      { keys: ["Dividend Ex-Date"], ru: "Экс-дивидендная дата" },
    ],
  },
  {
    title: "Акционеры и шорты",
    rows: [
      { keys: ["Shs Outstand"], ru: "Акций в обращении" },
      { keys: ["Shs Float"], ru: "Free float" },
      { keys: ["Insider Own"], ru: "Доля инсайдеров" },
      { keys: ["Insider Trans"], ru: "Сделки инсайдеров", tone: "growth" },
      { keys: ["Inst Own"], ru: "Доля институционалов" },
      { keys: ["Inst Trans"], ru: "Сделки институционалов", tone: "growth" },
      { keys: ["Short Float"], ru: "Шорт от float" },
      { keys: ["Short Ratio"], ru: "Дней на покрытие шорта" },
      { keys: ["Short Interest"], ru: "Объём шорта" },
    ],
  },
  {
    title: "Торговля и техника",
    rows: [
      { keys: ["Beta"], ru: "Бета" },
      { keys: ["ATR (14)", "ATR"], ru: "ATR (14)" },
      { keys: ["Volatility"], ru: "Волатильность нед./мес." },
      { keys: ["Avg Volume"], ru: "Средний объём" },
      { keys: ["Rel Volume"], ru: "Относительный объём" },
      { keys: ["RSI (14)"], ru: "RSI (14)" },
      { keys: ["SMA20"], ru: "От SMA20", tone: "growth" },
      { keys: ["SMA50"], ru: "От SMA50", tone: "growth" },
      { keys: ["SMA200"], ru: "От SMA200", tone: "growth" },
      { keys: ["52W High"], ru: "От 52-нед. макс.", tone: "growth" },
      { keys: ["52W Low"], ru: "От 52-нед. мин.", tone: "growth" },
      { keys: ["Perf Week"], ru: "За неделю", tone: "growth" },
      { keys: ["Perf Month"], ru: "За месяц", tone: "growth" },
      { keys: ["Perf Quarter"], ru: "За квартал", tone: "growth" },
      { keys: ["Perf YTD"], ru: "С начала года", tone: "growth" },
      { keys: ["Perf Year"], ru: "За год", tone: "growth" },
    ],
  },
];

const pick = (f: Record<string, string>, keys: string[]) => {
  for (const k of keys) if (f[k] && f[k] !== "-") return f[k];
  return undefined;
};

function recomLabel(v: number) {
  if (!isFinite(v)) return null;
  if (v <= 1.5) return { t: "Активно покупать", c: "up" as const };
  if (v <= 2.5) return { t: "Покупать", c: "up" as const };
  if (v <= 3.5) return { t: "Держать", c: "warn" as const };
  if (v <= 4.5) return { t: "Продавать", c: "down" as const };
  return { t: "Активно продавать", c: "down" as const };
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: React.ReactNode; tone?: string }) {
  return (
    <div className="border border-line bg-white/[0.02] px-3 py-2">
      <div className="text-[10px] tracking-wider text-faint uppercase">{label}</div>
      <div className={`tnum text-lg font-semibold ${tone ?? "neon-text"}`}>{value}</div>
      {sub && <div className="text-[11px]">{sub}</div>}
    </div>
  );
}

export function FundamentalsPanel({ symbol, price }: { symbol: string; price?: number }) {
  const { data, loading, error } = useFundamentals(symbol);
  const [all, setAll] = useState(false);
  if (loading && !data) return <div className="card grid h-48 place-items-center p-5 text-sm text-muted">&gt; загрузка показателей {symbol}…</div>;
  if (!data) return <div className="card p-5 text-sm text-muted">Фундаментальные данные недоступны{error ? `: ${error}` : ""}.</div>;
  const f = data.fields;
  const target = num(f["Target Price"]);
  const upside = price && isFinite(target) ? (target / price - 1) * 100 : NaN;
  const rec = recomLabel(num(f["Recom"]));
  const growthTone = (v: string) => (/^-/.test(v) ? "text-down" : /^\d/.test(v) && num(v) > 0 ? "text-up" : "text-ink");

  return (
    <section className="card p-5">
      <SectionTitle
        title={`Фундаментал ${symbol}`}
        subtitle={[data.name, data.sector, data.industry, data.country].filter(Boolean).join(" · ")}
        right={
          <div className="flex items-center gap-2">
            <Pill tone={data.source === "finviz" ? "brand" : data.source === "demo" ? "warn" : "neutral"}>
              {data.source === "finviz" ? "Finviz" : data.source === "yahoo" ? "Yahoo" : "DEMO"}
            </Pill>
            <a href={`https://finviz.com/quote.ashx?t=${encodeURIComponent(symbol)}`} target="_blank" rel="noreferrer" className="text-xs text-brand hover:text-ink">
              Finviz ↗
            </a>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        <Tile label="P/E" value={pick(f, ["P/E"]) ?? "—"} />
        <Tile label="Форв. P/E" value={pick(f, ["Forward P/E"]) ?? "—"} />
        <Tile label="EPS ttm" value={pick(f, ["EPS (ttm)"]) ?? "—"} />
        <Tile label="Капитализация" value={pick(f, ["Market Cap"]) ?? "—"} />
        <Tile
          label="Цель аналитиков"
          value={pick(f, ["Target Price"]) ?? "—"}
          sub={isFinite(upside) ? <span className={upside >= 0 ? "text-up" : "text-down"}>{fmtPct(upside, 1)} к цене</span> : undefined}
        />
        <Tile label="Рейтинг (1–5)" value={pick(f, ["Recom"]) ?? "—"} sub={rec ? <span className={`text-${rec.c}`}>{rec.t}</span> : undefined} />
        <Tile label="Шорт / float" value={pick(f, ["Short Float"]) ?? "—"} />
        <Tile label="Дивиденд" value={pick(f, ["Dividend TTM", "Dividend", "Dividend %"]) ?? "—"} tone="text-ink" />
      </div>

      <div className="mt-4 grid gap-x-6 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
        {GROUPS.map((g) => {
          const rows = g.rows.map((r) => ({ ...r, v: pick(f, r.keys) })).filter((r) => r.v);
          if (!rows.length) return null;
          return (
            <div key={g.title}>
              <div className="mb-1 text-[11px] tracking-[0.15em] text-neon-pink uppercase">{"// "}{g.title}</div>
              {rows.map((r) => (
                <div key={r.ru} className="flex items-baseline justify-between gap-3 border-b border-line/40 py-1 text-xs" title={r.keys[0]}>
                  <span className="text-muted">{r.ru}</span>
                  <span className={`tnum text-right font-medium ${r.tone === "growth" ? growthTone(r.v!) : "text-ink"}`}>{r.v}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="mt-3">
        <button onClick={() => setAll((v) => !v)} className="text-xs text-brand hover:text-ink">
          {all ? "Скрыть" : `Все показатели (${Object.keys(f).length})`} ▾
        </button>
        {all && (
          <div className="tnum mt-2 grid grid-cols-2 gap-x-4 text-[11px] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {Object.entries(f).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2 border-b border-line/30 py-0.5">
                <span className="truncate text-faint">{k}</span>
                <span className="text-ink">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="mt-2 text-[10px] text-faint">
        Обновлено {new Date(data.updatedAt).toLocaleTimeString("ru-RU")} · обновляется каждые 5 минут
        {price ? ` · цена ${fmtPrice(price)}` : ""}
      </p>
    </section>
  );
}

/** Compact day-trader card: float, short interest, earnings date, rel. volume. */
export function DayFundamentals({ symbol }: { symbol: string }) {
  const { data } = useFundamentals(/^[A-Z.\-]{1,6}$/.test(symbol) && !symbol.endsWith("-USD") ? symbol : null);
  if (!data) return null;
  const f = data.fields;
  const items: [string, string | undefined][] = [
    ["Free float", pick(f, ["Shs Float"])],
    ["Шорт / float", pick(f, ["Short Float"])],
    ["Отн. объём", pick(f, ["Rel Volume"])],
    ["Ср. объём", pick(f, ["Avg Volume"])],
    ["Отчёт", pick(f, ["Earnings"])],
    ["P/E", pick(f, ["P/E"])],
    ["Капитализация", pick(f, ["Market Cap"])],
    ["Бета", pick(f, ["Beta"])],
  ];
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] tracking-[0.15em] text-neon-pink uppercase">{"// finviz"}</span>
        <span className="truncate text-[11px] text-faint">{data.sector}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {items.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2 border-b border-line/40 py-0.5">
            <span className="text-muted">{k}</span>
            <span className="tnum text-ink">{v ?? "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
