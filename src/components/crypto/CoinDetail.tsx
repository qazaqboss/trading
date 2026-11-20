"use client";

import { useEffect, useMemo, useState } from "react";
import { useCandles } from "@/lib/candles";
import { cg, liveFor, type CgCoinDetail, type LiveTick } from "@/lib/crypto";
import { fmtBig, fmtPct, fmtPrice, upDown } from "@/lib/format";
import type { Candle, Timeframe } from "@/lib/types";
import { ChartToolbar } from "../DayTrading";
import { TickerNewsPanel } from "../FinPanels";
import TradingChart, { type Indicators } from "../TradingChart";
import { Change, LivePrice, Pill, SectionTitle, Segmented } from "../ui";

const CG_RANGES = [
  { v: "1", label: "24ч" },
  { v: "7", label: "7д" },
  { v: "30", label: "30д" },
  { v: "90", label: "90д" },
  { v: "365", label: "1г" },
  { v: "max", label: "Всё" },
] as const;
type CgRange = (typeof CG_RANGES)[number]["v"];

/** CoinGecko OHLC for coins that have no Binance USDT pair. */
function useCgOhlc(id: string, days: CgRange, enabled: boolean) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = () =>
      cg<[number, number, number, number, number][]>(`coins/${id}/ohlc`, { vs_currency: "usd", days })
        .then((rows) => {
          if (!alive) return;
          const seen = new Set<number>();
          setCandles(
            rows
              .map(([t, o, h, l, c]) => ({ t: Math.floor(t / 1000), o, h, l, c, v: 0 }))
              .filter((c) => (seen.has(c.t) ? false : (seen.add(c.t), true)))
              .sort((a, b) => a.t - b.t),
          );
          setErr(null);
        })
        .catch((e) => alive && setErr((e as Error).message));
    const t = setTimeout(() => {
      setCandles([]);
      load();
    }, 0);
    const id2 = setInterval(load, 120_000);
    return () => {
      alive = false;
      clearTimeout(t);
      clearInterval(id2);
    };
  }, [id, days, enabled]);
  return { candles, err };
}

function Stat({ k, v, cls = "text-ink", sub }: { k: string; v: React.ReactNode; cls?: string; sub?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/40 py-1.5 text-xs">
      <span className="text-muted">{k}</span>
      <span className={`tnum text-right font-medium ${cls}`}>
        {v}
        {sub && <span className="ml-1 text-[11px] text-faint">{sub}</span>}
      </span>
    </div>
  );
}

const fmtSupply = (v: number | null | undefined, sym: string) => (v ? `${fmtBig(v)} ${sym}` : "∞ / —");
const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }) : "—");

export default function CoinDetail({
  id,
  ticks,
  onClose,
  starred,
  onStar,
}: {
  id: string;
  ticks: Record<string, LiveTick>;
  onClose: () => void;
  starred: boolean;
  onStar: () => void;
}) {
  const [d, setD] = useState<CgCoinDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tf, setTf] = useState<Timeframe>("1h");
  const [range, setRange] = useState<CgRange>("30");
  const [mode, setMode] = useState<"candles" | "line">("candles");
  const [ind, setInd] = useState<Indicators>({ volume: true, ema: true, vwap: false, sma: false, rsi: true });
  const [more, setMore] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      cg<CgCoinDetail>(`coins/${id}`, { localization: false, tickers: false, market_data: true, community_data: false, developer_data: false })
        .then((x) => {
          if (alive) {
            setD(x);
            setErr(null);
          }
        })
        .catch((e) => alive && setErr((e as Error).message));
    const t = setTimeout(() => {
      setD(null);
      load();
    }, 0);
    const iv = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearTimeout(t);
      clearInterval(iv);
    };
  }, [id]);

  const sym = d?.symbol.toUpperCase() ?? "";
  const md = d?.market_data;
  const live = d && md ? liveFor({ symbol: d.symbol, current_price: md.current_price.usd, market_cap_rank: d.market_cap_rank }, ticks) : null;
  const onBinance = !!live;
  const bin = useCandles(onBinance ? `${sym}-USD` : "", tf, onBinance);
  const cgo = useCgOhlc(id, range, !!d && !onBinance);
  const candles = onBinance ? bin.candles : cgo.candles;
  const price = live?.c ?? md?.current_price.usd ?? 0;
  const ch24 = live ? (live.c / live.o - 1) * 100 : (md?.price_change_percentage_24h ?? 0);
  const chartTf: Timeframe = onBinance ? tf : range === "1" || range === "7" || range === "30" ? "1h" : "1d";
  const cgInd = useMemo<Indicators>(() => ({ ...ind, volume: false, vwap: false }), [ind]);

  if (err && !d) return <div className="card p-5 text-sm text-down">Не удалось загрузить монету: {err}</div>;
  if (!d || !md) return <div className="card grid h-64 place-items-center text-sm text-muted">&gt; загрузка {id}…</div>;

  const desc = (d.description.en ?? "").replace(/<[^>]+>/g, "").trim();
  const fromAth = price && md.ath.usd ? (price / md.ath.usd - 1) * 100 : md.ath_change_percentage.usd;
  const links = [
    ...d.links.homepage.filter(Boolean).slice(0, 1).map((u) => ["Сайт", u]),
    ...d.links.blockchain_site.filter(Boolean).slice(0, 2).map((u) => ["Эксплорер", u]),
    ...(d.links.twitter_screen_name ? [["X / Twitter", `https://x.com/${d.links.twitter_screen_name}`]] : []),
    ...(d.links.repos_url?.github?.[0] ? [["GitHub", d.links.repos_url.github[0]]] : []),
    ["CoinGecko", `https://www.coingecko.com/en/coins/${d.id}`],
    ...(onBinance ? [["Binance", `https://www.binance.com/en/trade/${sym}_USDT`]] : []),
  ];
  const contracts = Object.entries(d.platforms ?? {}).filter(([, a]) => a);

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="border border-brand/50 px-2 py-1 text-xs text-brand hover:bg-brand hover:text-black">
              ← Все монеты
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.image.large} alt="" width={44} height={44} className="h-11 w-11 rounded-full" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold">{d.name}</h2>
                <span className="text-sm text-faint">{sym}</span>
                {d.market_cap_rank && <Pill tone="brand">#{d.market_cap_rank}</Pill>}
                {onBinance ? <Pill tone="up">● Binance live</Pill> : <Pill>CoinGecko · 1 мин</Pill>}
                <button onClick={onStar} className={`text-lg ${starred ? "text-warn" : "text-faint hover:text-warn"}`} aria-label="Избранное">
                  {starred ? "★" : "☆"}
                </button>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {d.categories.slice(0, 6).map((c) => (
                  <span key={c} className="border border-line px-1.5 text-[10px] text-muted">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="text-right">
            <LivePrice value={price} className="text-3xl font-bold text-brand" />
            <div className="mt-1 flex justify-end gap-3 text-sm">
              <span className="text-faint">24ч</span>
              <Change v={ch24} className="font-semibold" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="card p-4">
          <div className="mb-3">
            {onBinance ? (
              <ChartToolbar tf={tf} setTf={setTf} mode={mode} setMode={setMode} ind={ind} setInd={setInd} live={bin.live} />
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Segmented value={range} onChange={setRange} options={CG_RANGES.map((r) => ({ value: r.v, label: r.label }))} />
                <Segmented
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "candles", label: "Свечи" },
                    { value: "line", label: "Линия" },
                  ]}
                />
                <span className="text-[11px] text-faint">Нет пары на Binance — свечи CoinGecko (обновление раз в 2 мин)</span>
              </div>
            )}
          </div>
          {candles.length ? (
            <TradingChart candles={candles} symbol={`${sym}-USD`} tf={chartTf} mode={mode} ind={onBinance ? ind : cgInd} height={ind.rsi ? 500 : 460} />
          ) : (
            <div className="grid h-[460px] place-items-center text-sm text-muted">{bin.error ?? cgo.err ?? "> загрузка свечей…"}</div>
          )}
        </div>

        <div className="card p-5">
          <SectionTitle title="Показатели" subtitle="CoinGecko" />
          <Stat k="Капитализация" v={fmtBig(md.market_cap.usd, "$")} />
          <Stat k="FDV (полная оценка)" v={fmtBig(md.fully_diluted_valuation?.usd, "$")} />
          <Stat k="Объём 24ч" v={fmtBig(md.total_volume.usd, "$")} sub={md.market_cap.usd ? `${((md.total_volume.usd / md.market_cap.usd) * 100).toFixed(1).replace(".", ",")}% кап.` : undefined} />
          <Stat k="Мин / макс 24ч" v={`${fmtPrice(md.low_24h.usd)} – ${fmtPrice(md.high_24h.usd)}`} />
          <Stat k="В обращении" v={fmtSupply(md.circulating_supply, sym)} />
          <Stat k="Всего выпущено" v={fmtSupply(md.total_supply, sym)} />
          <Stat k="Макс. эмиссия" v={fmtSupply(md.max_supply, sym)} />
          <Stat k="Исторический максимум" v={fmtPrice(md.ath.usd)} sub={fmtDate(md.ath_date.usd)} />
          <Stat k="От максимума" v={fmtPct(fromAth, 1)} cls={upDown(fromAth)} />
          <Stat k="Исторический минимум" v={fmtPrice(md.atl.usd)} sub={fmtDate(md.atl_date.usd)} />
          <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[11px]">
            {(
              [
                ["1ч", md.price_change_percentage_1h_in_currency?.usd],
                ["7д", md.price_change_percentage_7d],
                ["14д", md.price_change_percentage_14d],
                ["30д", md.price_change_percentage_30d],
                ["1г", md.price_change_percentage_1y],
                ["От ATL", md.atl_change_percentage.usd],
              ] as [string, number | undefined][]
            ).map(([k, v]) => (
              <div key={k} className="border border-line py-1">
                <div className="text-faint">{k}</div>
                {v != null ? <Change v={v} digits={1} /> : <span className="text-faint">—</span>}
              </div>
            ))}
          </div>
          {d.genesis_date && <Stat k="Запуск" v={fmtDate(d.genesis_date)} />}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <div className="card p-5">
          <SectionTitle title={`О проекте ${d.name}`} />
          <div className="mb-3 flex flex-wrap gap-2">
            {links.map(([label, url]) => (
              <a key={url} href={url} target="_blank" rel="noreferrer noopener" className="border border-brand/40 px-2 py-0.5 text-xs text-brand hover:bg-brand hover:text-black">
                {label} ↗
              </a>
            ))}
          </div>
          {desc ? (
            <p className="text-sm leading-relaxed whitespace-pre-line text-muted">
              {more || desc.length < 600 ? desc : `${desc.slice(0, 600)}…`}
              {desc.length >= 600 && (
                <button onClick={() => setMore((m) => !m)} className="ml-1 text-brand">
                  {more ? "свернуть" : "читать дальше"}
                </button>
              )}
            </p>
          ) : (
            <p className="text-sm text-faint">Описания нет.</p>
          )}
          {contracts.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 text-[11px] tracking-[0.15em] text-neon-pink uppercase">{"// контракты"}</div>
              {contracts.slice(0, 6).map(([chain, addr]) => (
                <div key={chain} className="flex items-center justify-between gap-2 border-b border-line/40 py-1 text-xs">
                  <span className="text-muted">{chain}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(addr).then(() => {
                        setCopied(addr);
                        setTimeout(() => setCopied(null), 1500);
                      });
                    }}
                    className="truncate font-mono text-ink hover:text-brand"
                    title="Скопировать адрес"
                  >
                    {copied === addr ? "скопировано ✓" : `${addr.slice(0, 8)}…${addr.slice(-6)}`}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <TickerNewsPanel symbol={`${sym}-USD`} dense maxH="max-h-[420px]" />
      </div>
    </div>
  );
}
