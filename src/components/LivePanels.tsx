"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fmtNum } from "@/lib/format";
import { useLiveQuotes } from "@/lib/live";
import type { LiveQuote, Mover } from "@/lib/types";
import { Change, LivePrice, SectionTitle, Segmented, Sparkline } from "./ui";

/* ───────────── US symbol directory (lazy, shared) ───────────── */

export type SymbolRow = [string, string, string, 0 | 1];
interface Directory {
  rows: SymbolRow[];
  source: "nasdaqtrader" | "fallback";
}
let dirPromise: Promise<Directory> | null = null;

function loadDirectory(): Promise<Directory> {
  dirPromise ??= fetch("/api/symbols")
    .then((r) => r.json() as Promise<Directory>)
    .catch(() => {
      dirPromise = null;
      return { rows: [], source: "fallback" as const };
    });
  return dirPromise;
}

export function useUsDirectory(enabled: boolean) {
  const [dir, setDir] = useState<Directory | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadDirectory().then((d) => alive && setDir(d));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return dir;
}

function rankMatches(rows: SymbolRow[], q: string, limit: number): SymbolRow[] {
  const Q = q.trim().toUpperCase();
  if (!Q) return rows.slice(0, limit);
  const exact: SymbolRow[] = [];
  const prefix: SymbolRow[] = [];
  const name: SymbolRow[] = [];
  for (const r of rows) {
    if (r[0] === Q) exact.push(r);
    else if (r[0].startsWith(Q)) prefix.push(r);
    else if (r[1].toUpperCase().includes(Q)) name.push(r);
    if (exact.length + prefix.length >= limit && name.length >= limit) break;
  }
  return [...exact, ...prefix, ...name].slice(0, limit);
}

/* ───────────── Header search: any US stock ───────────── */

export function SymbolSearch({ onOpen }: { onOpen: (symbol: string, name?: string) => void }) {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [remote, setRemote] = useState<{ symbol: string; name: string; exch: string }[]>([]);
  const [active, setActive] = useState(0);
  const dir = useUsDirectory(focused || q.length > 0);
  const box = useRef<HTMLDivElement>(null);

  const local = useMemo(() => (dir && q ? rankMatches(dir.rows, q, 10) : []), [dir, q]);

  // Yahoo search complements the directory (indices, crypto, names in other spellings)
  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const j = (await r.json()) as { results: { symbol: string; name: string; exch: string }[] };
        setRemote(j.results);
      } catch {
        /* ignore */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const results = useMemo(() => {
    const seen = new Set<string>();
    const out: { symbol: string; name: string; exch: string }[] = [];
    const add = (r: { symbol: string; name: string; exch: string }) => {
      if (seen.has(r.symbol)) return;
      seen.add(r.symbol);
      out.push(r);
    };
    local.forEach((r) => add({ symbol: r[0], name: r[1], exch: r[2] }));
    if (q.trim().length >= 2) remote.forEach(add);
    return out.slice(0, 12);
  }, [local, remote, q]);

  const pick = (r: { symbol: string; name: string }) => {
    onOpen(r.symbol, r.name);
    setQ("");
    setFocused(false);
    (document.activeElement as HTMLElement | null)?.blur();
  };

  return (
    <div ref={box} className="relative w-full sm:w-72">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, results.length - 1));
          if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
          if (e.key === "Enter") {
            const r = results[active] ?? (q.trim() ? { symbol: q.trim().toUpperCase(), name: "" } : null);
            if (r) pick(r);
          }
          if (e.key === "Escape") (e.target as HTMLInputElement).blur();
        }}
        placeholder="⌕ Любая акция США: AAPL, Tesla…"
        className="w-full border border-brand/50 bg-black/40 px-3 py-1.5 text-sm outline-none placeholder:text-faint focus:border-brand focus:shadow-[0_0_12px_rgba(5,217,232,0.4)]"
      />
      {focused && q && (
        <div className="absolute right-0 left-0 z-40 mt-1 max-h-96 overflow-y-auto border border-brand/50 bg-bg/95 shadow-[0_0_24px_rgba(5,217,232,0.25)] backdrop-blur-xl">
          {results.length === 0 && <div className="px-3 py-2 text-xs text-muted">{dir ? "Ничего не найдено — Enter откроет тикер напрямую" : "Загрузка справочника…"}</div>}
          {results.map((r, i) => (
            <button
              key={r.symbol}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(r)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${i === active ? "bg-brand/15" : "hover:bg-white/5"}`}
            >
              <span className="w-16 shrink-0 font-semibold text-brand">{r.symbol}</span>
              <span className="truncate text-muted">{r.name}</span>
              <span className="ml-auto shrink-0 text-[10px] text-faint">{r.exch}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────── Watchlist ───────────── */

export function Watchlist({
  symbols,
  quotes,
  onOpen,
  onRemove,
  selected,
}: {
  symbols: string[];
  quotes: Record<string, LiveQuote>;
  onOpen: (s: string, name?: string) => void;
  onRemove: (s: string) => void;
  selected: string;
}) {
  return (
    <section className="card p-5">
      <SectionTitle title="Мои акции · онлайн" subtitle="Добавляйте любые акции США звёздочкой ☆ в поиске или в разделе «Все акции США»" />
      {symbols.length === 0 && <p className="py-6 text-center text-sm text-muted">Список пуст — найдите акцию через поиск в шапке.</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {symbols.map((s) => {
          const q = quotes[s];
          return (
            <div
              key={s}
              onClick={() => onOpen(s, q?.name)}
              className={`group relative cursor-pointer border bg-white/[0.02] p-3 transition hover:border-brand ${selected === s ? "border-brand shadow-[0_0_14px_rgba(5,217,232,0.3)]" : "border-line"}`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(s);
                }}
                aria-label={`Убрать ${s}`}
                className="absolute top-1 right-1.5 text-xs text-faint opacity-0 transition group-hover:opacity-100 hover:text-down"
              >
                ✕
              </button>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-brand">{s}</span>
                {q && <Change v={q.chPct} className="text-xs" />}
              </div>
              <div className="truncate text-[11px] text-faint">{q?.name ?? "…"}</div>
              <div className="mt-1 text-lg font-semibold">{q ? <LivePrice value={q.price} /> : <span className="text-faint">—</span>}</div>
              <div className="mt-1">
                <Sparkline data={q?.spark ?? []} width={140} height={26} fill={false} responsive />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ───────────── All US stocks: movers + full directory ───────────── */

const fmtBig = (v: number) =>
  !v ? "—" : v >= 1e12 ? `${fmtNum(v / 1e12, 2)} трлн` : v >= 1e9 ? `${fmtNum(v / 1e9, 1)} млрд` : v >= 1e6 ? `${fmtNum(v / 1e6, 1)} млн` : fmtNum(v);

function Movers({ onOpen, watch }: { onOpen: (s: string, n?: string) => void; watch: { has: (s: string) => boolean; toggle: (s: string) => void } }) {
  const [data, setData] = useState<Record<string, Mover[]> | null>(null);
  const [tab, setTab] = useState<"day_gainers" | "day_losers" | "most_actives">("day_gainers");
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/movers")
        .then((r) => r.json())
        .then((d) => alive && setData(d))
        .catch(() => alive && setData({}));
    load();
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  const list = data?.[tab] ?? [];
  return (
    <div className="card p-5">
      <SectionTitle
        title="Движение рынка США"
        subtitle="Обновляется каждые 30 секунд"
        right={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "day_gainers", label: "Рост" },
              { value: "day_losers", label: "Падение" },
              { value: "most_actives", label: "Активные" },
            ]}
          />
        }
      />
      {!data ? (
        <p className="py-6 text-center text-sm text-muted">Загрузка…</p>
      ) : list.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Источник лидеров рынка сейчас недоступен.</p>
      ) : (
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-line">
                <th className="px-2 py-2 font-medium" />
                <th className="px-2 py-2 font-medium">Тикер</th>
                <th className="px-2 py-2 text-right font-medium">Цена</th>
                <th className="px-2 py-2 text-right font-medium">Изм.</th>
                <th className="px-2 py-2 text-right font-medium">Объём</th>
                <th className="px-2 py-2 text-right font-medium">Капитализация</th>
              </tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.symbol} onClick={() => onOpen(m.symbol, m.name)} className="cursor-pointer border-b border-line/60 hover:bg-white/[0.03]">
                  <td className="px-2">
                    <Star on={watch.has(m.symbol)} onClick={() => watch.toggle(m.symbol)} />
                  </td>
                  <td className="px-2 py-2">
                    <div className="font-semibold text-brand">{m.symbol}</div>
                    <div className="max-w-[220px] truncate text-[11px] text-faint">{m.name}</div>
                  </td>
                  <td className="px-2 text-right">
                    <LivePrice value={m.price} />
                  </td>
                  <td className="px-2 text-right">
                    <Change v={m.chPct} />
                  </td>
                  <td className="tnum px-2 text-right text-muted">{fmtBig(m.volume)}</td>
                  <td className="tnum px-2 text-right text-muted">{fmtBig(m.marketCap)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Star({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={on ? "Убрать из избранного" : "Добавить в избранное"}
      className={`text-base leading-none ${on ? "text-warn" : "text-faint hover:text-warn"}`}
    >
      {on ? "★" : "☆"}
    </button>
  );
}

const PAGE = 50;

export function UsStocksPanel({
  onOpen,
  watch,
}: {
  onOpen: (s: string, name?: string) => void;
  watch: { has: (s: string) => boolean; toggle: (s: string) => void };
}) {
  const dir = useUsDirectory(true);
  const [q, setQ] = useState("");
  const [exch, setExch] = useState<"all" | "Nasdaq" | "NYSE" | "other">("all");
  const [kind, setKind] = useState<"stock" | "etf" | "all">("stock");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!dir) return [];
    const base = dir.rows.filter(
      (r) =>
        (kind === "all" || (kind === "etf" ? r[3] === 1 : r[3] === 0)) &&
        (exch === "all" || (exch === "other" ? r[2] !== "Nasdaq" && r[2] !== "NYSE" : r[2] === exch)),
    );
    return q ? rankMatches(base, q, 500) : base;
  }, [dir, q, exch, kind]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const rows = filtered.slice(cur * PAGE, cur * PAGE + PAGE);
  const { quotes } = useLiveQuotes(
    rows.map((r) => r[0]),
    15_000,
    rows.length > 0,
  );

  return (
    <>
      <Movers onOpen={onOpen} watch={watch} />
      <div className="card p-5">
        <SectionTitle
          title="Все акции США"
          subtitle={
            dir
              ? `${fmtNum(dir.rows.length)} бумаг NYSE, Nasdaq и др. · цены текущей страницы обновляются каждые 15 с${dir.source === "fallback" ? " · справочник недоступен, показан базовый список" : ""}`
              : "Загрузка справочника…"
          }
        />
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Фильтр: тикер или название…"
            className="w-full border border-brand/40 bg-black/30 px-3 py-1.5 text-sm outline-none placeholder:text-faint focus:border-brand sm:w-64"
          />
          <Segmented
            value={exch}
            onChange={(v) => {
              setExch(v);
              setPage(0);
            }}
            options={[
              { value: "all", label: "Все биржи" },
              { value: "Nasdaq", label: "Nasdaq" },
              { value: "NYSE", label: "NYSE" },
              { value: "other", label: "Другие" },
            ]}
          />
          <Segmented
            value={kind}
            onChange={(v) => {
              setKind(v);
              setPage(0);
            }}
            options={[
              { value: "stock", label: "Акции" },
              { value: "etf", label: "ETF" },
              { value: "all", label: "Все" },
            ]}
          />
          <span className="ml-auto text-xs text-muted">Найдено: {fmtNum(filtered.length)}</span>
        </div>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-line">
                <th className="w-6 px-2 py-2" />
                <th className="px-2 py-2 font-medium">Тикер</th>
                <th className="px-2 py-2 font-medium">Компания</th>
                <th className="px-2 py-2 font-medium">Биржа</th>
                <th className="px-2 py-2 text-right font-medium">Цена</th>
                <th className="px-2 py-2 text-right font-medium">Изм.</th>
                <th className="px-2 py-2 font-medium">Сегодня</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([s, name, ex, etf]) => {
                const qt = quotes[s];
                return (
                  <tr key={s} onClick={() => onOpen(s, name)} className="cursor-pointer border-b border-line/60 hover:bg-white/[0.03]">
                    <td className="px-2">
                      <Star on={watch.has(s)} onClick={() => watch.toggle(s)} />
                    </td>
                    <td className="px-2 py-2 font-semibold text-brand">
                      {s}
                      {etf ? <span className="ml-1 text-[10px] text-warn">ETF</span> : null}
                    </td>
                    <td className="max-w-[280px] truncate px-2 text-muted">{name}</td>
                    <td className="px-2 text-xs text-faint">{ex}</td>
                    <td className="px-2 text-right">{qt ? <LivePrice value={qt.price} /> : <span className="text-faint">…</span>}</td>
                    <td className="px-2 text-right">{qt ? <Change v={qt.chPct} /> : null}</td>
                    <td className="px-2">
                      <Sparkline data={qt?.spark ?? []} width={80} height={22} fill={false} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="mt-3 flex items-center justify-center gap-2 text-xs">
            <PagerBtn disabled={cur === 0} onClick={() => setPage(0)}>«</PagerBtn>
            <PagerBtn disabled={cur === 0} onClick={() => setPage(cur - 1)}>‹ Назад</PagerBtn>
            <span className="tnum px-2 text-muted">
              {cur + 1} / {pages}
            </span>
            <PagerBtn disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Вперёд ›</PagerBtn>
            <PagerBtn disabled={cur >= pages - 1} onClick={() => setPage(pages - 1)}>»</PagerBtn>
          </div>
        )}
      </div>
    </>
  );
}

function PagerBtn({ children, disabled, onClick }: { children: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="border border-brand/40 px-2.5 py-1 text-brand transition hover:bg-brand hover:text-black disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-brand"
    >
      {children}
    </button>
  );
}


