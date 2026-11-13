"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ACCENT, CLASS_LABEL, fmtPct, fmtPrice } from "@/lib/format";
import type { MarketPayload } from "@/lib/types";
import PriceChart, { type Range } from "./PriceChart";
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
import { Change, Pill, Segmented } from "./ui";

const HERO = ["^GSPC", "BTC-USD", "GC=F"];
const REFRESH_MS = 60_000;

export default function Dashboard() {
  const [data, setData] = useState<MarketPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState("^GSPC");
  const [range, setRange] = useState<Range>("1Y");

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
    const id = setInterval(load, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  const select = useCallback((s: string) => {
    setSelected(s);
    document.getElementById("chart")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const bySymbol = useMemo(() => new Map(data?.assets.map((a) => [a.symbol, a]) ?? []), [data]);
  const markets = data?.assets.filter((a) => a.cls !== "stock") ?? [];
  const stocks = data?.assets.filter((a) => a.cls === "stock") ?? [];
  const asset = bySymbol.get(selected) ?? data?.assets[0];
  const accent = ACCENT[asset?.symbol ?? ""] ?? "#05d9e8";
  const longs = data?.ideas.filter((i) => i.direction === "LONG").length ?? 0;
  const shorts = data?.ideas.filter((i) => i.direction === "SHORT").length ?? 0;

  return (
    <div className="min-h-screen overflow-x-clip">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-brand/40 bg-bg/85 shadow-[0_0_24px_rgba(5,217,232,0.15)] backdrop-blur-xl">
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
                &gt; рынки · s&amp;p 500 · btc · gold · идеи<span className="flicker">_</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {data?.source === "demo" ? (
              <Pill tone="warn">⚠ DEMO//DATA</Pill>
            ) : data ? (
              <span className="flex items-center gap-1.5 text-up">
                <span className="pulse-dot h-2 w-2 rounded-full bg-up" /> ONLINE
              </span>
            ) : null}
            {data && (
              <span className="hidden text-muted sm:inline">
                Обновлено {new Date(data.updatedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
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
        {data && <TickerTape assets={markets} onSelect={select} />}
      </header>

      <main className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6">
        {error && !data && (
          <div className="card border-down/40 p-4 text-sm text-down">Не удалось загрузить данные: {error}</div>
        )}
        {data && data.errors.length > 0 && (
          <div className="rounded-[2px] border border-warn/30 bg-warn/10 px-4 py-2 text-xs text-warn">
            {data.errors.slice(0, 3).join(" · ")}
            {data.errors.length > 3 && ` · и ещё ${data.errors.length - 3}`}
          </div>
        )}

        {!data ? (
          <Skeleton />
        ) : (
          <>
            {/* Summary strip */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Режим рынка" value={data.regime.label} sub={`индекс ${data.regime.score > 0 ? "+" : ""}${data.regime.score}`} />
              <Stat label="Активных идей" value={String(data.ideas.length)} sub={`${longs} long · ${shorts} short`} />
              <Stat
                label="Акций выше SMA50"
                value={`${Math.round((stocks.filter((s) => s.m.price > s.m.sma50).length / Math.max(1, stocks.length)) * 100)}%`}
                sub="ширина рынка"
              />
              <Stat
                label="Лидер дня"
                value={(() => {
                  const top = [...data.assets].sort((a, b) => b.m.ch1d - a.m.ch1d)[0];
                  return `${top.ticker} ${fmtPct(top.m.ch1d, 1)}`;
                })()}
                sub="среди всех активов"
              />
            </div>

            {/* Hero */}
            <div className="grid gap-4 lg:grid-cols-3">
              {HERO.map((s) => {
                const a = bySymbol.get(s);
                return a ? <HeroCard key={s} a={a} accent={ACCENT[s]} active={selected === s} onClick={() => select(s)} /> : null;
              })}
            </div>

            {/* Other markets */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {markets
                .filter((a) => !HERO.includes(a.symbol))
                .map((a) => (
                  <MiniCard key={a.symbol} a={a} active={selected === a.symbol} onClick={() => select(a.symbol)} />
                ))}
            </div>

            {/* Chart + detail */}
            {asset && (
              <section id="chart" className="grid scroll-mt-32 gap-4 xl:grid-cols-[1fr_340px]">
                <div className="card p-5">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
                        <h2 className="text-lg font-semibold">{asset.name}</h2>
                        {asset.ticker !== asset.name && <span className="text-sm text-faint">{asset.ticker}</span>}
                        <Pill>{CLASS_LABEL[asset.cls]}</Pill>
                      </div>
                      <div className="mt-1 flex items-baseline gap-3">
                        <span className="tnum neon-text text-3xl font-semibold">{fmtPrice(asset.m.price)}</span>
                        <Change v={asset.m.ch1d} className="text-sm font-semibold" />
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Segmented
                        value={range}
                        onChange={setRange}
                        options={(["1M", "3M", "6M", "1Y", "2Y"] as Range[]).map((r) => ({
                          value: r,
                          label: { "1M": "1М", "3M": "3М", "6M": "6М", "1Y": "1Г", "2Y": "2Г" }[r],
                        }))}
                      />
                      <div className="flex gap-3 text-[11px] text-muted">
                        <span className="flex items-center gap-1"><span className="h-0.5 w-3" style={{ background: accent }} />Цена</span>
                        <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-[#d300c5]" />SMA50</span>
                        <span className="flex items-center gap-1"><span className="h-0.5 w-3 border-t border-dashed border-[#f9f002]" />SMA200</span>
                      </div>
                    </div>
                  </div>
                  <PriceChart history={asset.history} color={accent} range={range} />
                  <div className="mt-2 flex justify-end">
                    <a
                      href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(asset.tv ?? asset.ticker.replace(".", ""))}`}
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
                </div>
              </section>
            )}

            {/* Ideas */}
            <IdeasPanel ideas={data.ideas} onSelect={select} />

            {/* Regime / F&G / Performance */}
            <div className="grid gap-4 lg:grid-cols-3">
              <RegimePanel regime={data.regime} />
              <FearGreedPanel fg={data.fearGreed} />
              <PerformanceBars assets={markets} />
            </div>

            {/* Stocks */}
            <StocksTable stocks={stocks} onSelect={select} selected={selected} />

            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
              <Heatmap stocks={stocks} onSelect={select} />
              <CorrelationMatrix labels={data.correlation.labels} matrix={data.correlation.matrix} />
            </div>

            <footer className="pb-8 pt-2 text-center text-[11px] leading-relaxed text-faint">
              Данные: Yahoo Finance (задержка до 15 мин), alternative.me. Идеи формируются автоматически по техническим правилам
              (тренд, SMA, RSI, волатильность) и не являются индивидуальной инвестиционной рекомендацией.
              <br />
              Используйте собственный риск-менеджмент. Последнее обновление: {new Date(data.updatedAt).toLocaleString("ru-RU")}.
            </footer>
          </>
        )}
      </main>
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
