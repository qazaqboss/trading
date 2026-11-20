"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ACCENT, CLASS_LABEL, fmtPct, fmtPrice } from "@/lib/format";
import { useCryptoStream, useLiveQuotes, useUsSession, useWatchlist, type UsSession } from "@/lib/live";
import type { Asset, Candle, Idea, MarketPayload, Timeframe } from "@/lib/types";
import { SymbolSearch, UsStocksPanel, Watchlist } from "./LivePanels";
import DayTrading, { ChartToolbar } from "./DayTrading";
import { FundamentalsPanel, MarketNewsPanel, TickerNewsPanel } from "./FinPanels";
import TradingChart, { type Indicators } from "./TradingChart";
import { useCandles } from "@/lib/candles";
import {
  AssetStats,
  CorrelationMatrix,
  FearGreedPanel,
  Heatmap,
  HeroCard,
  IdeasPanel,
  MiniCard,
  PerformanceBars,
  RegimePanel,
  StocksTable,
  TickerTape,
} from "./Panels";
import { Change, Collapsible, LivePrice, Pill } from "./ui";

const HERO = ["^GSPC", "BTC-USD", "GC=F"];
const MAIN_MINI = ["^NDX", "^DJI", "ETH-USD", "CL=F", "^VIX"];
const SNAPSHOT_MS = 5 * 60_000; // history + indicators
const LIVE_MS = 5_000; // quotes

type Extra = { asset: Asset; idea: Idea | null };

export default function Dashboard() {
  const [data, setData] = useState<MarketPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState("^GSPC");
  const [tf, setTf] = useState<Timeframe>("1d");
  const [chartMode, setChartMode] = useState<"candles" | "line">("candles");
  const [ind, setInd] = useState<Indicators>({ volume: true, ema: false, vwap: false, sma: true, rsi: false });
  const [view, setView] = useState<"overview" | "day">("overview");
  const [daySymbol, setDaySymbol] = useState("SPY");
  const [extra, setExtra] = useState<Record<string, Extra>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [assetErr, setAssetErr] = useState<string | null>(null);
  const watch = useWatchlist();
  const session = useUsSession();

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const v = location.hash === "#day" ? "day" : location.hash === "#overview" ? "overview" : localStorage.getItem("neon-pulse:view");
        if (v === "day" || v === "overview") setView(v);
        const ds = localStorage.getItem("neon-pulse:daysym");
        if (ds) setDaySymbol(ds);
      } catch {
        /* ignore */
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const switchView = (v: "overview" | "day") => {
    setView(v);
    try {
      localStorage.setItem("neon-pulse:view", v);
      history.replaceState(null, "", v === "day" ? "#day" : "#overview");
    } catch {
      /* ignore */
    }
    window.scrollTo({ top: 0 });
  };
  const pickDaySymbol = (s: string) => {
    setDaySymbol(s);
    try {
      localStorage.setItem("neon-pulse:daysym", s);
    } catch {
      /* ignore */
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/market", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const id = setInterval(load, SNAPSHOT_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  /* ── live layer ── */
  const crypto = useCryptoStream(!!data);
  const liveSymbols = useMemo(
    () => [...(data?.assets.map((a) => a.symbol) ?? []), ...watch.list, selected],
    [data, watch.list, selected],
  );
  const { quotes, source: liveSource, lastAt } = useLiveQuotes(liveSymbols, LIVE_MS, !!data);

  const applyLive = useCallback(
    (a: Asset): Asset => {
      const q = quotes[a.symbol];
      const price = crypto.prices[a.symbol] ?? q?.price;
      if (!price) return a;
      const prev = q?.prevClose ?? a.history[a.history.length - 2]?.c ?? a.m.price;
      return {
        ...a,
        m: { ...a.m, price, ch1d: (price / prev - 1) * 100, fromHigh: (price / Math.max(a.m.high52, price) - 1) * 100 },
      };
    },
    [quotes, crypto.prices],
  );

  const assets = useMemo(() => data?.assets.map(applyLive) ?? [], [data, applyLive]);
  const bySymbol = useMemo(() => new Map(assets.map((a) => [a.symbol, a])), [assets]);
  const markets = assets.filter((a) => a.cls !== "stock");
  const stocks = assets.filter((a) => a.cls === "stock");
  const extraAsset = extra[selected] ? applyLive(extra[selected].asset) : undefined;
  const asset = bySymbol.get(selected) ?? extraAsset ?? assets[0];
  const idea = data?.ideas.find((i) => i.symbol === asset?.symbol) ?? extra[asset?.symbol ?? ""]?.idea ?? null;
  const accent = ACCENT[asset?.symbol ?? ""] ?? "#05d9e8";
  const chartData = useCandles(asset?.symbol ?? "", tf, view === "overview" && !!asset);
  const fallbackCandles: Candle[] = useMemo(
    () => (asset ? asset.history.map((b) => ({ t: Date.parse(b.t) / 1000, o: b.c, h: b.c, l: b.c, c: b.c, v: 0 })) : []),
    [asset],
  );
  const useFallback = !chartData.candles.length && !!chartData.error;

  const scrollToChart = () => document.getElementById("chart")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const openSymbol = useCallback(
    async (sym: string, name?: string) => {
      const s = sym.toUpperCase();
      setAssetErr(null);
      if (data?.assets.some((a) => a.symbol === s) || extra[s]) {
        setSelected(s);
        scrollToChart();
        return;
      }
      setPending(s);
      scrollToChart();
      try {
        const r = await fetch(`/api/asset?symbol=${encodeURIComponent(s)}${name ? `&name=${encodeURIComponent(name)}` : ""}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        setExtra((e) => ({ ...e, [s]: j }));
        setSelected(s);
      } catch (e) {
        setAssetErr((e as Error).message);
      } finally {
        setPending(null);
      }
    },
    [data, extra],
  );

  const demo = data?.source === "demo" || liveSource === "demo";

  return (
    <div className="min-h-screen overflow-x-clip">
      {/* Header */}
      <header style={{ paddingTop: "env(safe-area-inset-top)" }} className="relative top-0 z-30 border-b sm:sticky border-brand/40 bg-bg/85 shadow-[0_0_24px_rgba(5,217,232,0.15)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center border border-brand bg-brand/10 text-xl font-bold text-brand shadow-[0_0_14px_rgba(5,217,232,0.6)]">
              ◢
            </div>
            <div>
              <h1 data-text="NEON//PULSE" className="glitch text-xl leading-tight font-black">
                NEON//PULSE
              </h1>
              <p className="text-[11px] tracking-[0.2em] text-neon-pink uppercase">
                &gt; котировки онлайн<span className="flicker">_</span>
              </p>
            </div>
          </div>
          <div className="flex border border-brand/50">
            {(
              [
                ["overview", "Обзор"],
                ["day", "⚡ Дэйтрейдинг"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => switchView(v)}
                className={`px-3 py-1.5 text-xs font-semibold tracking-wider uppercase transition ${
                  view === v ? "bg-brand text-black shadow-[0_0_14px_rgba(5,217,232,0.6)]" : "text-brand hover:bg-brand/10"
                }`}
              >
                {label}
              </button>
            ))}
            <Link href="/crypto" className="px-3 py-1.5 text-xs font-semibold tracking-wider text-brand uppercase transition hover:bg-brand/10">
              ◈ Крипто
            </Link>
          </div>
          <div className="order-3 w-full sm:order-none sm:w-auto">
            <SymbolSearch onOpen={(sym, name) => (view === "day" ? pickDaySymbol(sym.toUpperCase()) : openSymbol(sym, name))} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <SessionPill s={session} />
            <span className={`flex items-center gap-1.5 ${crypto.connected ? "text-up" : "text-faint"}`} title="Крипто-поток Binance">
              <span className={`h-2 w-2 rounded-full ${crypto.connected ? "pulse-dot bg-up" : "bg-faint"}`} />
              CRYPTO
            </span>
            {demo ? (
              <Pill tone="warn">⚠ DEMO//DATA</Pill>
            ) : data ? (
              <span className="flex items-center gap-1.5 text-up">
                <span className="pulse-dot h-2 w-2 rounded-full bg-up" /> ONLINE
              </span>
            ) : null}
            {lastAt && (
              <span className="tnum hidden text-muted md:inline">
                {new Date(lastAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
            <button
              onClick={load}
              disabled={loading}
              className="border border-neon-pink px-3 py-1.5 font-medium text-neon-pink shadow-[0_0_10px_rgba(255,42,109,0.35)] transition hover:bg-neon-pink hover:text-black disabled:opacity-50"
            >
              {loading ? "SYNC…" : "↻ SYNC"}
            </button>
          </div>
        </div>
        {data && <TickerTape assets={markets} onSelect={openSymbol} />}
      </header>

      <main className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6">
        {error && !data && <div className="card p-4 text-sm text-down">Не удалось загрузить данные: {error}</div>}
        {data && data.errors.length > 0 && (
          <div className="border border-warn/30 bg-warn/10 px-4 py-2 text-xs text-warn">
            {data.errors.slice(0, 3).join(" · ")}
            {data.errors.length > 3 && ` · и ещё ${data.errors.length - 3}`}
          </div>
        )}

        {view === "day" ? (
          <DayTrading symbol={daySymbol} setSymbol={pickDaySymbol} watchlist={watch.list} cryptoPrices={crypto.prices} />
        ) : !data ? (
          <Skeleton />
        ) : (
          <>
            {/* Core markets */}
            <div className="grid gap-4 lg:grid-cols-3">
              {HERO.map((s) => {
                const a = bySymbol.get(s);
                return a ? <HeroCard key={s} a={a} accent={ACCENT[s]} active={selected === s} onClick={() => openSymbol(s)} /> : null;
              })}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {MAIN_MINI.map((s) => {
                const a = bySymbol.get(s);
                return a ? <MiniCard key={s} a={a} active={selected === s} onClick={() => openSymbol(s)} /> : null;
              })}
            </div>

            {/* Watchlist */}
            <Watchlist symbols={watch.list} quotes={quotes} onOpen={openSymbol} onRemove={watch.toggle} selected={selected} />

            {/* Chart + detail */}
            {asset && (
              <section id="chart" className="relative grid scroll-mt-40 gap-4 xl:grid-cols-[1fr_340px]">
                {pending && (
                  <div className="absolute inset-0 z-10 grid place-items-center bg-bg/60 backdrop-blur-sm">
                    <span className="neon-text text-sm">&gt; загрузка {pending}…</span>
                  </div>
                )}
                <div className="card p-5">
                  {assetErr && <div className="mb-3 border border-down/40 bg-down/10 px-3 py-1.5 text-xs text-down">{assetErr}</div>}
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="h-2.5 w-2.5" style={{ background: accent, boxShadow: `0 0 10px ${accent}` }} />
                        <h2 className="truncate text-lg font-semibold">{asset.name}</h2>
                        {asset.ticker !== asset.name && <span className="text-sm text-faint">{asset.ticker}</span>}
                        <Pill>{CLASS_LABEL[asset.cls]}</Pill>
                        <button
                          onClick={() => watch.toggle(asset.symbol)}
                          className={`text-lg leading-none ${watch.has(asset.symbol) ? "text-warn" : "text-faint hover:text-warn"}`}
                          aria-label="В избранное"
                          title={watch.has(asset.symbol) ? "Убрать из «Мои акции»" : "Добавить в «Мои акции»"}
                        >
                          {watch.has(asset.symbol) ? "★" : "☆"}
                        </button>
                      </div>
                      <div className="mt-1 flex items-baseline gap-3">
                        <LivePrice value={asset.m.price} className="neon-text text-3xl font-semibold" />
                        <Change v={asset.m.ch1d} className="text-sm font-semibold" />
                      </div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <ChartToolbar tf={tf} setTf={setTf} mode={chartMode} setMode={setChartMode} ind={ind} setInd={setInd} live={chartData.live} />
                  </div>
                  {chartData.loading && !chartData.candles.length && !useFallback ? (
                    <div className="grid h-[460px] place-items-center text-sm text-muted">&gt; загрузка свечей…</div>
                  ) : (
                    <TradingChart
                      candles={useFallback ? fallbackCandles : chartData.candles}
                      symbol={asset.symbol}
                      tf={useFallback ? "1d" : tf}
                      mode={useFallback ? "line" : chartMode}
                      ind={ind}
                    />
                  )}
                  <div className="mt-2 flex justify-end">
                    <a
                      href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(asset.tv ?? asset.ticker.replace("-", "."))}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-brand hover:text-ink"
                    >
                      Открыть в TradingView ↗
                    </a>
                  </div>
                </div>
                <div className="card p-5">
                  <h3 className="mb-4 text-sm font-semibold text-muted">Технический профиль</h3>
                  <AssetStats a={asset} />
                  <SignalBox idea={idea} />
                </div>
              </section>
            )}

            {/* Fundamentals + news for the selected asset */}
            {asset && (
              <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
                {asset.cls === "stock" ? <FundamentalsPanel symbol={asset.symbol} price={asset.m.price} /> : <MarketNewsPanel />}
                <TickerNewsPanel symbol={asset.symbol} />
              </div>
            )}

            {/* Top ideas */}
            <IdeasPanel ideas={data.ideas} onSelect={openSymbol} />

            {asset?.cls === "stock" && <MarketNewsPanel />}

            {/* Hidden sections */}
            <Collapsible id="us-stocks" title="Все акции США" subtitle="Справочник NYSE / Nasdaq, лидеры роста и падения, онлайн-цены, поиск">
              {() => <UsStocksPanel onOpen={openSymbol} watch={watch} />}
            </Collapsible>

            <Collapsible id="megacaps" title="Мега-капы: сигналы и тепловая карта" subtitle={`${stocks.length} крупнейших акций с техническим рейтингом`}>
              {() => (
                <>
                  <StocksTable stocks={stocks} onSelect={openSymbol} selected={selected} />
                  <Heatmap stocks={stocks} onSelect={openSymbol} />
                </>
              )}
            </Collapsible>

            <Collapsible id="macro" title="Все рынки и макро" subtitle="Остальные индексы, сырьё, доллар, ставки, режим рынка, корреляции">
              {() => (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {markets
                      .filter((a) => !HERO.includes(a.symbol) && !MAIN_MINI.includes(a.symbol))
                      .map((a) => (
                        <MiniCard key={a.symbol} a={a} active={selected === a.symbol} onClick={() => openSymbol(a.symbol)} />
                      ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Stat label="Режим рынка" value={data.regime.label} sub={`индекс ${data.regime.score > 0 ? "+" : ""}${data.regime.score}`} />
                    <Stat
                      label="Активных идей"
                      value={String(data.ideas.length)}
                      sub={`${data.ideas.filter((i) => i.direction === "LONG").length} long · ${data.ideas.filter((i) => i.direction === "SHORT").length} short`}
                    />
                    <Stat
                      label="Акций выше SMA50"
                      value={`${Math.round((stocks.filter((s) => s.m.price > s.m.sma50).length / Math.max(1, stocks.length)) * 100)}%`}
                      sub="ширина рынка"
                    />
                    <Stat
                      label="Лидер дня"
                      value={(() => {
                        const top = [...assets].sort((a, b) => b.m.ch1d - a.m.ch1d)[0];
                        return top ? `${top.ticker} ${fmtPct(top.m.ch1d, 1)}` : "—";
                      })()}
                      sub="среди всех активов"
                    />
                  </div>
                  <div className="grid gap-4 lg:grid-cols-3">
                    <RegimePanel regime={data.regime} />
                    <FearGreedPanel fg={data.fearGreed} />
                    <PerformanceBars assets={markets} />
                  </div>
                  <CorrelationMatrix labels={data.correlation.labels} matrix={data.correlation.matrix} />
                </>
              )}
            </Collapsible>

            <footer className="pb-8 pt-2 text-center text-[11px] leading-relaxed text-faint">
              Онлайн-данные: Binance WebSocket (крипта, каждую секунду), Yahoo Finance (акции, индексы, сырьё — каждые 5 с),
              справочник бумаг — Nasdaq Trader. Идеи формируются автоматически по техническим правилам и не являются
              индивидуальной инвестиционной рекомендацией.
            </footer>
          </>
        )}
      </main>
    </div>
  );
}

function SessionPill({ s }: { s: UsSession | null }) {
  if (!s) return null;
  const map: Record<UsSession, [string, "up" | "warn" | "neutral"]> = {
    open: ["NYSE ● торги", "up"],
    pre: ["NYSE · премаркет", "warn"],
    post: ["NYSE · постмаркет", "warn"],
    closed: ["NYSE · закрыта", "neutral"],
  };
  const [label, tone] = map[s];
  return <Pill tone={tone}>{label}</Pill>;
}

function SignalBox({ idea }: { idea: Idea | null }) {
  if (!idea)
    return <div className="mt-5 border border-line px-3 py-2 text-xs text-muted">Сигнал: активного сетапа нет — наблюдаем.</div>;
  const tone = idea.direction === "LONG" ? "text-up" : idea.direction === "SHORT" ? "text-down" : "text-warn";
  return (
    <div className="mt-5 border border-brand/40 bg-brand/5 p-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="tracking-widest text-neon-pink uppercase">{"// сигнал"}</span>
        <span className={`font-semibold ${tone}`}>{idea.direction}</span>
      </div>
      <div className="mt-1 text-sm text-ink">{idea.setup}</div>
      <div className="tnum mt-2 grid grid-cols-3 gap-2 text-center">
        <div><div className="text-faint">Вход</div>{fmtPrice(idea.entry)}</div>
        <div><div className="text-faint">Стоп</div><span className="text-down">{fmtPrice(idea.stop)}</span></div>
        <div><div className="text-faint">Цель</div><span className="text-up">{fmtPrice(idea.target)}</span></div>
      </div>
      <div className="mt-2 text-faint">уверенность {idea.confidence}% · {idea.horizon}</div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-[11px] tracking-[0.15em] text-neon-pink uppercase">{"// "}{label}</div>
      <div className="tnum neon-text mt-0.5 truncate text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted">{sub}</div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card h-56 animate-pulse" />
        ))}
      </div>
      <div className="card h-96 animate-pulse" />
      <p className="text-center text-sm text-muted">&gt; подключение к рыночной сети…</p>
    </div>
  );
}
