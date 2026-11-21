"use client";

import { useMemo, useState } from "react";
import { fmtNum, fmtPct, fmtPrice, heatColor, upDown } from "@/lib/format";
import type { Asset, Direction, FearGreed, Idea, Regime } from "@/lib/types";
import { Change, Gauge, LivePrice, Pill, RsiBar, ScorePill, SectionTitle, Segmented, Sparkline, TrendPill } from "./ui";

/* ───────────── Ticker tape ───────────── */
export function TickerTape({ assets, onSelect }: { assets: Asset[]; onSelect: (s: string) => void }) {
  const items = [...assets, ...assets];
  return (
    <div className="relative overflow-hidden border-y border-line bg-panel/60">
      <div className="marquee flex w-max gap-8 py-2 pl-4">
        {items.map((a, i) => (
          <button key={i} onClick={() => onSelect(a.symbol)} className="flex items-center gap-2 text-xs whitespace-nowrap">
            <span className="font-semibold text-ink">{a.ticker}</span>
            <LivePrice value={a.m.price} className="text-muted" />
            <Change v={a.m.ch1d} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───────────── Hero cards (S&P, BTC, Gold) ───────────── */
export function HeroCard({ a, accent, active, onClick }: { a: Asset; accent: string; active: boolean; onClick: () => void }) {
  const spark = a.history.slice(-90).map((b) => b.c);
  return (
    <button
      onClick={onClick}
      className={`card group relative overflow-hidden p-5 text-left transition hover:-translate-y-0.5 ${active ? "ring-2" : ""}`}
      style={{ ["--tw-ring-color" as string]: accent }}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl" style={{ background: `${accent}22` }} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5" style={{ background: accent, boxShadow: `0 0 10px ${accent}` }} />
            <span className="text-sm font-medium tracking-widest text-muted uppercase">{a.name}</span>
          </div>
          <div className="mt-1 text-4xl font-semibold tracking-tight">
            <LivePrice value={a.m.price} className="font-semibold" style={{ color: accent }} />
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <Change v={a.m.ch1d} className="font-semibold" />
            <span className="text-faint">за день</span>
          </div>
        </div>
        <TrendPill trend={a.m.trend} />
      </div>
      <div className="mt-4">
        <Sparkline data={spark} width={320} height={64} color={accent} responsive />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
        {(
          [
            ["1Н", a.m.ch1w],
            ["1М", a.m.ch1m],
            ["YTD", a.m.chYtd],
            ["1Г", a.m.ch1y],
          ] as const
        ).map(([l, v]) => (
          <div key={l} className="rounded-[2px] bg-white/[0.03] px-2 py-1.5">
            <div className="text-faint">{l}</div>
            <Change v={v} digits={1} className="font-medium" />
          </div>
        ))}
      </div>
    </button>
  );
}

/* ───────────── Compact market cards ───────────── */
export function MiniCard({ a, active, onClick }: { a: Asset; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`card flex min-w-0 flex-col gap-1 p-3 text-left transition hover:bg-panel-2 ${active ? "ring-2 ring-brand" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted">{a.name}</span>
        <span className="text-[10px] font-semibold text-faint">{a.ticker}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-lg font-semibold"><LivePrice value={a.m.price} /></div>
          <Change v={a.m.ch1d} className="text-xs" />
        </div>
        <Sparkline data={a.history.slice(-30).map((b) => b.c)} width={64} height={28} fill={false} />
      </div>
    </button>
  );
}

/* ───────────── Asset detail sidebar ───────────── */
export function AssetStats({ a }: { a: Asset }) {
  const m = a.m;
  const rows: [string, string, string?][] = [
    ["SMA 20", fmtPrice(m.sma20), upDown(m.price - m.sma20)],
    ["SMA 50", fmtPrice(m.sma50), upDown(m.price - m.sma50)],
    ["SMA 200", fmtPrice(m.sma200), upDown(m.price - m.sma200)],
    ["Волатильность 30д", `${fmtNum(m.vol30, 1)}%`],
    ["Средний дневной ход", fmtPrice(m.atr)],
    ["От 52-нед. максимума", fmtPct(m.fromHigh, 1), upDown(m.fromHigh)],
  ];
  const pos = m.high52 > m.low52 ? ((m.price - m.low52) / (m.high52 - m.low52)) * 100 : 50;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <TrendPill trend={m.trend} />
        <ScorePill score={m.score} />
        {m.cross === "golden" && <Pill tone="up">✦ Золотой крест</Pill>}
        {m.cross === "death" && <Pill tone="down">✕ Крест смерти</Pill>}
      </div>
      <div>
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>Технический рейтинг</span>
          <span className={`tnum font-semibold ${upDown(m.score)}`}>{m.score > 0 ? "+" : ""}{m.score}</span>
        </div>
        <div className="relative h-2 rounded-full bg-white/10">
          <div className="absolute left-1/2 top-0 h-2 w-px bg-white/30" />
          <div
            className="absolute top-0 h-2 rounded-full"
            style={{
              left: m.score >= 0 ? "50%" : `${50 + m.score / 2}%`,
              width: `${Math.abs(m.score) / 2}%`,
              background: m.score >= 0 ? "var(--color-up)" : "var(--color-down)",
            }}
          />
        </div>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>RSI 14</span>
          <span className="tnum">{fmtNum(m.rsi14, 0)} · {m.rsi14 >= 70 ? "перекупленность" : m.rsi14 <= 30 ? "перепроданность" : "нейтрально"}</span>
        </div>
        <div className="relative h-2 rounded-full bg-gradient-to-r from-up/60 via-white/10 to-down/60">
          <div className="absolute top-1/2 h-3.5 w-1.5 -translate-y-1/2 rounded bg-ink" style={{ left: `calc(${m.rsi14}% - 3px)` }} />
        </div>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>Диапазон 52 недели</span>
          <span className="tnum">{fmtNum(pos, 0)}%</span>
        </div>
        <div className="relative h-2 rounded-full bg-white/10">
          <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-neon-purple to-brand" style={{ width: `${pos}%` }} />
        </div>
        <div className="tnum mt-1 flex justify-between text-[11px] text-faint">
          <span>{fmtPrice(m.low52)}</span>
          <span>{fmtPrice(m.high52)}</span>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {rows.map(([k, v, c]) => (
          <div key={k} className="flex flex-col">
            <dt className="text-[11px] text-faint">{k}</dt>
            <dd className={`tnum font-medium ${c ?? "text-ink"}`}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ───────────── Market regime + Fear & Greed ───────────── */
export function RegimePanel({ regime }: { regime: Regime }) {
  const tone = regime.score > 10 ? "text-up" : regime.score < -10 ? "text-down" : "text-warn";
  return (
    <div className="card p-5">
      <SectionTitle title="Режим рынка" subtitle="Risk-On / Risk-Off по межрыночным сигналам" />
      <div className="flex flex-col items-center">
        <Gauge value={regime.score} signed label={`Режим рынка ${regime.score}`} />
        <div className={`-mt-1 text-xl font-semibold ${tone}`}>{regime.label}</div>
        <div className="tnum text-xs text-faint">индекс {regime.score > 0 ? "+" : ""}{regime.score} из ±100</div>
      </div>
      <ul className="mt-4 space-y-1.5 text-sm text-muted">
        {regime.notes.map((n) => (
          <li key={n} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
            {n}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FearGreedPanel({ fg }: { fg: FearGreed | null }) {
  return (
    <div className="card p-5">
      <SectionTitle title="Крипто: страх и жадность" subtitle="Crypto Fear & Greed Index" />
      {fg ? (
        <div className="flex flex-col items-center">
          <Gauge value={fg.value} label={`Индекс страха и жадности ${fg.value}`} />
          <div className="tnum -mt-1 text-3xl font-semibold">{fg.value}</div>
          <div className={`text-sm font-medium ${fg.value >= 55 ? "text-up" : fg.value <= 45 ? "text-down" : "text-warn"}`}>{fg.label}</div>
          <div className="mt-4 w-full">
            <div className="mb-1 text-[11px] text-faint">Последние 30 дней</div>
            <div className="flex h-10 items-end gap-[2px]">
              {fg.history.map((v, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{ height: `${Math.max(6, v)}%`, background: v >= 55 ? "#00ff9f" : v <= 45 ? "#ff2a6d" : "#f9f002", opacity: 0.4 + (i / fg.history.length) * 0.6 }}
                  title={`${v}`}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">Нет данных.</p>
      )}
    </div>
  );
}

/* ───────────── Trade ideas ───────────── */
const DIR_TONE: Record<Direction, "up" | "down" | "warn"> = { LONG: "up", SHORT: "down", WATCH: "warn" };
const DIR_LABEL: Record<Direction, string> = { LONG: "LONG ▲", SHORT: "SHORT ▼", WATCH: "НАБЛЮДАТЬ" };

export function IdeasPanel({ ideas, onSelect }: { ideas: Idea[]; onSelect: (s: string) => void }) {
  const [dir, setDir] = useState<"ALL" | Direction>("ALL");
  const [cls, setCls] = useState<"all" | "markets" | "stock">("all");
  const [showAll, setShowAll] = useState(false);
  const filtered = ideas
    .filter((i) => dir === "ALL" || i.direction === dir)
    .filter((i) => cls === "all" || (cls === "stock" ? i.cls === "stock" : i.cls !== "stock"));
  const list = showAll ? filtered : filtered.slice(0, 6);
  return (
    <section className="card p-5">
      <SectionTitle
        title="Торговые идеи"
        subtitle={`${ideas.length} сетапов по техническим правилам · обновляются вместе с котировками`}
        right={
          <div className="flex flex-wrap gap-2">
            <Segmented
              value={cls}
              onChange={setCls}
              options={[
                { value: "all", label: "Все" },
                { value: "markets", label: "Рынки" },
                { value: "stock", label: "Акции" },
              ]}
            />
            <Segmented
              value={dir}
              onChange={setDir}
              options={[
                { value: "ALL", label: "Любые" },
                { value: "LONG", label: "Long" },
                { value: "SHORT", label: "Short" },
                { value: "WATCH", label: "Watch" },
              ]}
            />
          </div>
        }
      />
      {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted">Нет идей под выбранный фильтр.</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((i) => (
          <article
            key={i.id}
            onClick={() => onSelect(i.symbol)}
            className="cursor-pointer rounded-[2px] border border-line bg-white/[0.02] p-4 transition hover:border-brand hover:shadow-[0_0_16px_rgba(5,217,232,0.25)] hover:bg-white/[0.04]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold">{i.ticker}</span>
                  <span className="truncate text-xs text-faint">{i.name}</span>
                </div>
                <div className="mt-0.5 text-sm text-ink/90">{i.setup}</div>
              </div>
              <Pill tone={DIR_TONE[i.direction]}>{DIR_LABEL[i.direction]}</Pill>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-white/10">
                <div className="h-1.5 rounded-full bg-gradient-to-r from-neon-pink via-neon-purple to-brand" style={{ width: `${i.confidence}%` }} />
              </div>
              <span className="tnum text-[11px] text-muted">уверенность {i.confidence}%</span>
            </div>
            <div className="tnum mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-[2px] bg-white/[0.04] py-1.5">
                <div className="text-faint">Вход</div>
                <div className="font-semibold">{fmtPrice(i.entry)}</div>
              </div>
              <div className="rounded-[2px] bg-down/10 py-1.5">
                <div className="text-faint">Стоп</div>
                <div className="font-semibold text-down">{fmtPrice(i.stop)}</div>
              </div>
              <div className="rounded-[2px] bg-up/10 py-1.5">
                <div className="text-faint">Цель</div>
                <div className="font-semibold text-up">{fmtPrice(i.target)}</div>
              </div>
            </div>
            <ul className="mt-3 space-y-1 text-xs text-muted">
              {i.reasons.map((r) => (
                <li key={r} className="flex gap-1.5">
                  <span className="text-brand">›</span>
                  {r}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between text-[11px] text-faint">
              <span>Горизонт: {i.horizon}</span>
              <span>R:R 1:{fmtNum(i.rr, 1)}</span>
            </div>
          </article>
        ))}
      </div>
      {filtered.length > 6 && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowAll((v) => !v)}
            className="rounded-[2px] bg-white/5 px-4 py-2 text-sm font-medium ring-1 ring-white/10 transition hover:bg-white/10"
          >
            {showAll ? "Свернуть" : `Показать все идеи (${filtered.length})`}
          </button>
        </div>
      )}
    </section>
  );
}

/* ───────────── Stocks table ───────────── */
type SortKey = "ticker" | "price" | "ch1d" | "ch1w" | "ch1m" | "chYtd" | "rsi14" | "score" | "fromHigh";

function SortTh({
  k,
  children,
  className = "",
  sort,
  setSort,
}: {
  k: SortKey;
  children: string;
  className?: string;
  sort: { k: SortKey; desc: boolean };
  setSort: (f: (s: { k: SortKey; desc: boolean }) => { k: SortKey; desc: boolean }) => void;
}) {
  return (
    <th className={`px-3 py-2 font-medium ${className}`}>
      <button
        onClick={() => setSort((s) => ({ k, desc: s.k === k ? !s.desc : true }))}
        className={`inline-flex items-center gap-1 hover:text-ink ${sort.k === k ? "text-ink" : ""}`}
      >
        {children}
        {sort.k === k && <span>{sort.desc ? "↓" : "↑"}</span>}
      </button>
    </th>
  );
}

export function StocksTable({ stocks, onSelect, selected }: { stocks: Asset[]; onSelect: (s: string) => void; selected: string }) {
  const [sort, setSort] = useState<{ k: SortKey; desc: boolean }>({ k: "score", desc: true });
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const val = (a: Asset) => (sort.k === "ticker" ? a.ticker : a.m[sort.k]);
    return stocks
      .filter((s) => !q || `${s.ticker} ${s.name} ${s.sector}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => {
        const x = val(a);
        const y = val(b);
        const r = typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number);
        return sort.desc ? -r : r;
      });
  }, [stocks, sort, q]);


  return (
    <section className="card p-5">
      <SectionTitle
        title="Акции"
        subtitle="Мега-капы США и крипто-акции · клик по строке открывает график"
        right={
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск тикера…"
            className="w-44 rounded-[2px] bg-white/5 px-3 py-1.5 text-sm ring-1 ring-white/10 outline-none placeholder:text-faint focus:ring-brand"
          />
        }
      />
      <div className="scroll-thin sm:-mx-5 sm:overflow-x-auto sm:px-5">
        <table className="w-full text-sm sm:min-w-[860px] [&_td]:px-1 [&_th]:px-1 sm:[&_td]:px-3 sm:[&_th]:px-3">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-line">
              <SortTh sort={sort} setSort={setSort} k="ticker">Тикер</SortTh>
              <SortTh sort={sort} setSort={setSort} k="price" className="text-right">Цена</SortTh>
              <SortTh sort={sort} setSort={setSort} k="ch1d" className="text-right">1Д</SortTh>
              <SortTh sort={sort} setSort={setSort} k="ch1w" className="text-right hidden sm:table-cell">1Н</SortTh>
              <SortTh sort={sort} setSort={setSort} k="ch1m" className="text-right hidden sm:table-cell">1М</SortTh>
              <SortTh sort={sort} setSort={setSort} k="chYtd" className="text-right">YTD</SortTh>
              <th className="px-3 py-2 font-medium hidden sm:table-cell">3 мес.</th>
              <SortTh sort={sort} setSort={setSort} k="rsi14" className="hidden sm:table-cell">RSI</SortTh>
              <SortTh sort={sort} setSort={setSort} k="fromHigh" className="text-right hidden sm:table-cell">От макс.</SortTh>
              <SortTh sort={sort} setSort={setSort} k="score" className="hidden sm:table-cell">Сигнал</SortTh>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr
                key={s.symbol}
                onClick={() => onSelect(s.symbol)}
                className={`cursor-pointer border-b border-line/60 transition hover:bg-white/[0.03] ${selected === s.symbol ? "bg-brand/10 shadow-[inset_3px_0_0_#05d9e8]" : ""}`}
              >
                <td className="px-3 py-2.5">
                  <div className="font-semibold">{s.ticker}</div>
                  <div className="max-w-[80px] truncate text-[11px] text-faint sm:max-w-none">{s.name} · {s.sector}</div>
                </td>
                <td className="px-3 text-right font-medium"><LivePrice value={s.m.price} /></td>
                <td className="px-3 text-right"><Change v={s.m.ch1d} /></td>
                <td className="px-3 text-right hidden sm:table-cell"><Change v={s.m.ch1w} /></td>
                <td className="px-3 text-right hidden sm:table-cell"><Change v={s.m.ch1m} /></td>
                <td className="px-3 text-right"><Change v={s.m.chYtd} digits={1} /></td>
                <td className="px-3 hidden sm:table-cell"><Sparkline data={s.history.slice(-63).map((b) => b.c)} width={90} height={26} fill={false} /></td>
                <td className="px-3 hidden sm:table-cell"><RsiBar v={s.m.rsi14} /></td>
                <td className="px-3 text-right hidden sm:table-cell"><Change v={s.m.fromHigh} digits={1} /></td>
                <td className="px-3 hidden sm:table-cell"><ScorePill score={s.m.score} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ───────────── Heatmap ───────────── */
type Period = "ch1d" | "ch1w" | "ch1m" | "chYtd";
const SPAN: Record<Period, number> = { ch1d: 3, ch1w: 6, ch1m: 12, chYtd: 40 };

export function Heatmap({ stocks, onSelect }: { stocks: Asset[]; onSelect: (s: string) => void }) {
  const [p, setP] = useState<Period>("ch1d");
  const sectors = useMemo(() => {
    const m = new Map<string, Asset[]>();
    stocks.forEach((s) => m.set(s.sector ?? "Прочее", [...(m.get(s.sector ?? "Прочее") ?? []), s]));
    return [...m.entries()].map(([name, list]) => ({
      name,
      list: list.sort((a, b) => b.m[p] - a.m[p]),
      avg: list.reduce((x, s) => x + s.m[p], 0) / list.length,
    })).sort((a, b) => b.avg - a.avg);
  }, [stocks, p]);
  return (
    <section className="card p-5">
      <SectionTitle
        title="Тепловая карта"
        subtitle="Доходность по секторам"
        right={
          <Segmented
            value={p}
            onChange={setP}
            options={[
              { value: "ch1d", label: "1Д" },
              { value: "ch1w", label: "1Н" },
              { value: "ch1m", label: "1М" },
              { value: "chYtd", label: "YTD" },
            ]}
          />
        }
      />
      <div className="space-y-3">
        {sectors.map((sec) => (
          <div key={sec.name}>
            <div className="mb-1 flex justify-between text-[11px] text-muted">
              <span>{sec.name}</span>
              <Change v={sec.avg} digits={1} />
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-1.5">
              {sec.list.map((s) => (
                <button
                  key={s.symbol}
                  onClick={() => onSelect(s.symbol)}
                  className="rounded-[2px] px-2 py-2.5 text-center ring-1 ring-white/5 transition hover:ring-white/30"
                  style={{ background: heatColor(s.m[p], SPAN[p]) }}
                >
                  <div className="text-xs font-semibold text-white">{s.ticker}</div>
                  <div className="tnum text-[11px] text-white/85">{fmtPct(s.m[p], 1)}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────── Cross-asset performance ───────────── */
export function PerformanceBars({ assets }: { assets: Asset[] }) {
  const [p, setP] = useState<Period | "ch1y">("chYtd");
  const list = assets.filter((a) => a.cls !== "macro" || a.symbol === "DX-Y.NYB").sort((a, b) => b.m[p] - a.m[p]);
  const max = Math.max(...list.map((a) => Math.abs(a.m[p])), 1);
  return (
    <section className="card p-5">
      <SectionTitle
        title="Межрыночная доходность"
        subtitle="Индексы, крипта, сырьё, доллар"
        right={
          <Segmented
            value={p}
            onChange={setP}
            options={[
              { value: "ch1w", label: "1Н" },
              { value: "ch1m", label: "1М" },
              { value: "chYtd", label: "YTD" },
              { value: "ch1y", label: "1Г" },
            ]}
          />
        }
      />
      <div className="space-y-1.5">
        {list.map((a) => {
          const v = a.m[p];
          const w = (Math.abs(v) / max) * 50;
          return (
            <div key={a.symbol} className="grid grid-cols-[72px_1fr_64px] items-center gap-2 text-xs">
              <span className="truncate font-medium text-muted">{a.ticker}</span>
              <div className="relative h-4">
                <div className="absolute inset-y-0 left-1/2 w-px bg-white/15" />
                <div
                  className="absolute inset-y-0.5 rounded"
                  style={{
                    left: v >= 0 ? "50%" : `${50 - w}%`,
                    width: `${w}%`,
                    background: v >= 0 ? "linear-gradient(90deg,#00ff9f55,#00ff9f)" : "linear-gradient(270deg,#ff2a6d55,#ff2a6d)",
                  }}
                />
              </div>
              <Change v={v} digits={1} className="text-right" />
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ───────────── Correlation matrix ───────────── */
export function CorrelationMatrix({ labels, matrix }: { labels: string[]; matrix: number[][] }) {
  const color = (v: number) => (v >= 0 ? `rgba(5,217,232,${Math.abs(v) * 0.85})` : `rgba(255,42,109,${Math.abs(v) * 0.85})`);
  return (
    <section className="card p-5">
      <SectionTitle title="Корреляции" subtitle="Дневные доходности, 90 общих торговых дней" />
      <div className="sm:overflow-x-auto">
        <table className="tnum w-full table-fixed text-[9px] sm:mx-auto sm:w-auto sm:table-auto sm:text-[11px]">
          <thead>
            <tr>
              <th />
              {labels.map((l) => (
                <th key={l} className="px-0.5 pb-1 leading-tight font-medium break-words text-muted sm:px-1">{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={labels[i]}>
                <th className="pr-1 text-right leading-tight font-medium text-muted sm:pr-2 sm:whitespace-nowrap">{labels[i]}</th>
                {row.map((v, j) => (
                  <td key={j} className="p-0.5">
                    <div
                      className="flex h-7 w-full items-center justify-center rounded-[2px] text-white sm:h-9 sm:w-11"
                      style={{ background: i === j ? "rgba(255,255,255,0.06)" : color(v) }}
                      title={`${labels[i]} / ${labels[j]}: ${v}`}
                    >
                      {i === j ? "—" : v.toFixed(2).replace(".", ",")}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-down" />обратная</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-white/10" />нет связи</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-brand" />прямая</span>
      </div>
    </section>
  );
}


