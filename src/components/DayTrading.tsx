"use client";

import { useEffect, useMemo, useState } from "react";
import { useCandles } from "@/lib/candles";
import { fmtNum, fmtPct, fmtPrice, upDown } from "@/lib/format";
import { useLiveQuotes } from "@/lib/live";
import { TF_LABEL, dayStats, followsUsHours, nyClock, scanSignals, usSessionAt, type DayStats, type TradeSignal } from "@/lib/ta";
import type { LiveQuote, Timeframe } from "@/lib/types";
import TradingChart, { type Indicators, type Level } from "./TradingChart";
import { Change, LivePrice, Pill, SectionTitle, Segmented, Sparkline } from "./ui";

/* ───────────── Shared chart toolbar ───────────── */

export const ALL_TF: Timeframe[] = ["1m", "5m", "15m", "1h", "1d", "1wk"];

export function ChartToolbar({
  tf,
  setTf,
  mode,
  setMode,
  ind,
  setInd,
  live,
}: {
  tf: Timeframe;
  setTf: (t: Timeframe) => void;
  mode: "candles" | "line";
  setMode: (m: "candles" | "line") => void;
  ind: Indicators;
  setInd: (i: Indicators) => void;
  live?: boolean;
}) {
  const chips: [keyof Indicators, string][] = [
    ["volume", "Объём"],
    ["ema", "EMA 9/21"],
    ["vwap", "VWAP"],
    ["sma", "SMA 50/200"],
    ["rsi", "RSI"],
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented value={tf} onChange={setTf} options={ALL_TF.map((t) => ({ value: t, label: TF_LABEL[t] }))} />
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "candles", label: "Свечи" },
          { value: "line", label: "Линия" },
        ]}
      />
      <div className="flex flex-wrap gap-1">
        {chips.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setInd({ ...ind, [k]: !ind[k] })}
            className={`border px-2 py-1 text-[11px] transition ${ind[k] ? "border-brand bg-brand/15 text-brand" : "border-line text-faint hover:text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {live !== undefined && (
        <span className={`ml-auto flex items-center gap-1.5 text-[11px] ${live ? "text-up" : "text-faint"}`}>
          <span className={`h-2 w-2 rounded-full ${live ? "pulse-dot bg-up" : "bg-faint"}`} />
          {live ? "LIVE" : "ожидание"}
        </span>
      )}
    </div>
  );
}

/* ───────────── New York session clock ───────────── */

function useNow(ms = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [ms]);
  return now;
}

const hm = (m: number) => `${Math.floor(m / 60)}ч ${String(m % 60).padStart(2, "0")}м`;

function SessionClock() {
  const now = useNow();
  if (!now) return null;
  const t = Math.floor(now / 1000);
  const { mins } = nyClock(t);
  const s = usSessionAt(t);
  const nyTime = new Date(now).toLocaleTimeString("ru-RU", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const next =
    s === "open" ? `до закрытия ${hm(960 - mins)}` : s === "pre" ? `до открытия ${hm(570 - mins)}` : s === "post" ? `постмаркет ещё ${hm(1200 - mins)}` : "биржа закрыта";
  const tone = s === "open" ? "up" : s === "closed" ? "neutral" : "warn";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-faint">Нью-Йорк</span>
      <span className="tnum neon-text">{nyTime}</span>
      <Pill tone={tone}>{{ open: "Торги", pre: "Премаркет", post: "Постмаркет", closed: "Закрыто" }[s]}</Pill>
      <span className="text-muted">{next}</span>
    </div>
  );
}

/* ───────────── Day stats ───────────── */

function StatsPanel({ st, price, symbol }: { st: DayStats | null; price?: number; symbol: string }) {
  if (!st) return <div className="card p-5 text-sm text-muted">Нет внутридневных данных.</div>;
  const last = price ?? st.last;
  const vwDist = (last / st.vwap - 1) * 100;
  const row = (k: string, v: React.ReactNode, cls = "text-ink") => (
    <div className="flex items-center justify-between border-b border-line/50 py-1.5 text-xs">
      <span className="text-muted">{k}</span>
      <span className={`tnum font-medium ${cls}`}>{v}</span>
    </div>
  );
  const orState =
    st.orHigh == null ? "—" : !st.orDone ? "формируется" : last > st.orHigh ? "пробой вверх ▲" : last < st.orLow! ? "пробой вниз ▼" : "внутри";
  return (
    <div className="card p-5">
      <SectionTitle title="Уровни дня" subtitle={`Сессия ${st.day}${followsUsHours(symbol) ? " · NYSE" : " · 24ч (UTC)"}`} />
      <div className="mb-3 flex items-baseline gap-3">
        <LivePrice value={last} className="neon-text text-3xl font-semibold" />
        <Change v={(last / st.prevClose - 1) * 100} className="text-sm font-semibold" />
      </div>
      {row("Открытие / гэп", <>{fmtPrice(st.open)} <span className={upDown(st.gapPct)}>({fmtPct(st.gapPct)})</span></>)}
      {row("Максимум дня (HOD)", fmtPrice(st.high), "text-up")}
      {row("Минимум дня (LOD)", fmtPrice(st.low), "text-down")}
      {row("VWAP", <>{fmtPrice(st.vwap)} <span className={upDown(vwDist)}>({fmtPct(vwDist)})</span></>, "text-[#ff7b00]")}
      {row("Вчера: закр. / макс. / мин.", `${fmtPrice(st.prevClose)} / ${fmtPrice(st.prevHigh)} / ${fmtPrice(st.prevLow)}`)}
      {st.preHigh != null && row("Премаркет макс. / мин.", `${fmtPrice(st.preHigh)} / ${fmtPrice(st.preLow!)}`)}
      {st.orHigh != null && row("Диапазон открытия 15м", `${fmtPrice(st.orLow!)} – ${fmtPrice(st.orHigh)} · ${orState}`)}
      {row("ATR дневной / пройдено", `${fmtPrice(st.atrDaily)} · ${fmtNum(st.rangePct, 0)}%`, st.rangePct > 100 ? "text-warn" : "text-ink")}
      {st.volume > 0 && row("Отн. объём (к средн. дню)", `${fmtNum(st.relVol, 2)}×`, st.relVol > 1.5 ? "text-up" : "text-ink")}
      <div className="mt-3 grid grid-cols-5 gap-1 text-center text-[10px]">
        {(["S2", "S1", "P", "R1", "R2"] as const).map((k) => (
          <div key={k} className={`border px-1 py-1 ${k.startsWith("R") ? "border-down/40" : k.startsWith("S") ? "border-up/40" : "border-brand/40"}`}>
            <div className="text-faint">{k}</div>
            <div className="tnum text-ink">{fmtPrice(st.pivots[k])}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────── Signal feed ───────────── */

function SignalFeed({ signals, tf }: { signals: TradeSignal[]; tf: Timeframe }) {
  const list = [...signals].reverse();
  return (
    <div className="card p-5">
      <SectionTitle title="Сигналы дня" subtitle={`Таймфрейм ${TF_LABEL[tf]} · EMA, VWAP, ORB, RSI, HOD/LOD`} />
      {list.length === 0 && <p className="py-4 text-center text-xs text-muted">Сигналов за сессию пока нет.</p>}
      <ul className="scroll-thin max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {list.map((s, i) => (
          <li key={`${s.t}-${s.kind}-${i}`} className="flex items-center gap-2 text-xs">
            <span className={`w-4 text-center ${s.dir === "up" ? "text-up" : "text-down"}`}>{s.dir === "up" ? "▲" : "▼"}</span>
            <span className="tnum w-12 shrink-0 text-faint">{new Date(s.t * 1000).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
            <span className="text-ink">{s.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────── Position size / risk calculator ───────────── */

function useStored(key: string, initial: number): [number, (v: number) => void] {
  const [v, setV] = useState(initial);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = localStorage.getItem(key);
        if (raw) setV(Number(raw));
      } catch {
        /* ignore */
      }
    }, 0);
    return () => clearTimeout(t);
  }, [key]);
  return [
    v,
    (x: number) => {
      setV(x);
      try {
        localStorage.setItem(key, String(x));
      } catch {
        /* ignore */
      }
    },
  ];
}

function RiskCalc({ price, suggestStop }: { price: number; suggestStop: number }) {
  const [account, setAccount] = useStored("neon-pulse:acct", 10000);
  const [riskPct, setRiskPct] = useStored("neon-pulse:riskpct", 1);
  const [entry, setEntry] = useState<string>("");
  const [stop, setStop] = useState<string>("");
  const e = Number(entry || price.toPrecision(6));
  const s = Number(stop || suggestStop.toPrecision(6));
  const perShare = Math.abs(e - s);
  const riskUsd = (account * riskPct) / 100;
  const qty = perShare > 0 ? Math.floor(riskUsd / perShare) : 0;
  const long = e >= s;
  const value = qty * e;
  const inp = "w-full border border-brand/40 bg-black/30 px-2 py-1 text-sm outline-none focus:border-brand tnum";
  return (
    <div className="card p-5">
      <SectionTitle title="Калькулятор позиции" subtitle="Размер позиции от риска на сделку" />
      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="space-y-1">
          <span className="text-muted">Депозит, $</span>
          <input type="number" className={inp} value={account} onChange={(x) => setAccount(Number(x.target.value))} />
        </label>
        <label className="space-y-1">
          <span className="text-muted">Риск на сделку, %</span>
          <input type="number" step="0.1" className={inp} value={riskPct} onChange={(x) => setRiskPct(Number(x.target.value))} />
        </label>
        <label className="space-y-1">
          <span className="text-muted">Вход</span>
          <input type="number" className={inp} placeholder={fmtPrice(price)} value={entry} onChange={(x) => setEntry(x.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-muted">Стоп</span>
          <input type="number" className={inp} placeholder={fmtPrice(suggestStop)} value={stop} onChange={(x) => setStop(x.target.value)} />
        </label>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="border border-line py-2">
          <div className="text-faint">Кол-во</div>
          <div className="tnum neon-text text-lg">{fmtNum(qty)}</div>
        </div>
        <div className="border border-line py-2">
          <div className="text-faint">Риск</div>
          <div className="tnum text-down">${fmtNum(riskUsd, 0)}</div>
        </div>
        <div className="border border-line py-2">
          <div className="text-faint">Объём</div>
          <div className={`tnum ${value > account ? "text-warn" : "text-ink"}`}>${fmtNum(value, 0)}</div>
        </div>
      </div>
      <div className="tnum mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
        {[1, 2, 3].map((r) => (
          <div key={r} className="bg-up/10 py-1">
            <span className="text-faint">{r}R </span>
            <span className="text-up">{fmtPrice(long ? e + perShare * r : e - perShare * r)}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-faint">
        {long ? "LONG" : "SHORT"} · стоп по умолчанию — за VWAP / минимумом дня. {value > account && "Позиция больше депозита — нужно плечо."}
      </p>
    </div>
  );
}

/* ───────────── Scanner ───────────── */

const DAY_LIST = ["SPY", "QQQ", "IWM", "NVDA", "TSLA", "AAPL", "AMD", "META", "AMZN", "MSFT", "GOOGL", "AVGO", "NFLX", "PLTR", "COIN", "MSTR", "BTC-USD", "ETH-USD", "SOL-USD"];

function Scanner({ symbols, quotes, active, onPick }: { symbols: string[]; quotes: Record<string, LiveQuote>; active: string; onPick: (s: string) => void }) {
  const [sort, setSort] = useState<"move" | "up" | "down">("move");
  const rows = symbols
    .map((s) => ({ s, q: quotes[s] }))
    .filter((r) => r.q)
    .sort((a, b) => (sort === "up" ? b.q.chPct - a.q.chPct : sort === "down" ? a.q.chPct - b.q.chPct : Math.abs(b.q.chPct) - Math.abs(a.q.chPct)));
  return (
    <div className="card p-5">
      <SectionTitle
        title="Сканер"
        subtitle="Популярные у дэйтрейдеров + ваш список · обновление 5 с"
        right={
          <Segmented
            value={sort}
            onChange={setSort}
            options={[
              { value: "move", label: "Движение" },
              { value: "up", label: "Рост" },
              { value: "down", label: "Падение" },
            ]}
          />
        }
      />
      {rows.length === 0 && <p className="py-4 text-center text-xs text-muted">Загрузка котировок…</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {rows.map(({ s, q }) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className={`border p-2 text-left transition hover:border-brand ${active === s ? "border-brand bg-brand/10" : "border-line"}`}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-brand">{s.replace("-USD", "")}</span>
              <Change v={q.chPct} className="text-xs" />
            </div>
            <div className="text-sm">
              <LivePrice value={q.price} />
            </div>
            <Sparkline data={q.spark ?? []} width={120} height={20} fill={false} responsive />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───────────── Day trading screen ───────────── */

const DT_IND: Indicators = { volume: true, ema: true, vwap: true, sma: false, rsi: true };

export default function DayTrading({
  symbol,
  setSymbol,
  watchlist,
  cryptoPrices,
}: {
  symbol: string;
  setSymbol: (s: string) => void;
  watchlist: string[];
  cryptoPrices: Record<string, number>;
}) {
  const [tf, setTf] = useState<Timeframe>("1m");
  const [mode, setMode] = useState<"candles" | "line">("candles");
  const [ind, setInd] = useState<Indicators>(DT_IND);
  const [showLevels, setShowLevels] = useState(true);

  const intra = useCandles(symbol, tf);
  // a fine intraday series for session levels regardless of the chart timeframe
  const levelTf: Timeframe = tf === "1m" || tf === "5m" ? tf : "5m";
  const levelSrc = useCandles(symbol, levelTf, levelTf !== tf);
  const daily = useCandles(symbol, "1d");
  const levelCandles = levelTf === tf ? intra.candles : levelSrc.candles;

  const scanSymbols = useMemo(() => [...new Set([...DAY_LIST, ...watchlist])], [watchlist]);
  const { quotes } = useLiveQuotes(scanSymbols, 5000);

  const st = useMemo(() => dayStats(levelCandles, daily.candles, symbol), [levelCandles, daily.candles, symbol]);
  const signals = useMemo(() => (tf === "1d" || tf === "1wk" ? [] : scanSignals(intra.candles, symbol, st)), [intra.candles, symbol, st, tf]);
  const price = cryptoPrices[symbol] ?? intra.candles[intra.candles.length - 1]?.c ?? quotes[symbol]?.price;

  const levels: Level[] = useMemo(() => {
    if (!st || !showLevels) return [];
    const L: Level[] = [
      { price: st.prevClose, title: "PDC", color: "#7fd8e6" },
      { price: st.prevHigh, title: "PDH", color: "#00ff9f" },
      { price: st.prevLow, title: "PDL", color: "#ff2a6d" },
    ];
    if (st.orHigh != null) L.push({ price: st.orHigh, title: "OR↑", color: "#f9f002" }, { price: st.orLow!, title: "OR↓", color: "#f9f002" });
    if (st.preHigh != null) L.push({ price: st.preHigh, title: "PM↑", color: "#d300c5" }, { price: st.preLow!, title: "PM↓", color: "#d300c5" });
    return L;
  }, [st, showLevels]);

  const suggestStop = st && price ? (price >= st.vwap ? Math.min(st.vwap, st.low) : Math.max(st.vwap, st.high)) : (price ?? 0) * 0.99;

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] tracking-[0.2em] text-neon-pink uppercase">{"// day trading"}</span>
          <h2 className="neon-text text-lg font-black">{symbol}</h2>
          {intra.name && <span className="max-w-[260px] truncate text-xs text-muted">{intra.name}</span>}
          {intra.source === "demo" && <Pill tone="warn">DEMO</Pill>}
          {intra.source === "binance" && <Pill tone="brand">Binance</Pill>}
        </div>
        <SessionClock />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {scanSymbols.slice(0, 19).map((s) => (
          <button
            key={s}
            onClick={() => setSymbol(s)}
            className={`border px-2 py-0.5 text-xs transition ${s === symbol ? "border-brand bg-brand text-black" : "border-line text-muted hover:border-brand hover:text-brand"}`}
          >
            {s.replace("-USD", "")}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <ChartToolbar tf={tf} setTf={setTf} mode={mode} setMode={setMode} ind={ind} setInd={setInd} live={intra.live} />
            <button
              onClick={() => setShowLevels((v) => !v)}
              className={`border px-2 py-1 text-[11px] ${showLevels ? "border-warn bg-warn/10 text-warn" : "border-line text-faint"}`}
            >
              Уровни
            </button>
          </div>
          {intra.error && <div className="mb-2 border border-down/40 bg-down/10 px-3 py-1.5 text-xs text-down">{intra.error}</div>}
          {intra.loading && !intra.candles.length ? (
            <div className="grid h-[520px] place-items-center text-sm text-muted">&gt; загрузка свечей {symbol} {TF_LABEL[tf]}…</div>
          ) : (
            <TradingChart candles={intra.candles} symbol={symbol} tf={tf} mode={mode} ind={ind} levels={levels} signals={signals} height={ind.rsi ? 560 : 520} />
          )}
          <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-faint">
            <span><span className="text-[#05d9e8]">━</span> EMA9</span>
            <span><span className="text-[#f9f002]">━</span> EMA21</span>
            <span><span className="text-[#ff7b00]">━</span> VWAP</span>
            <span>PDH/PDL/PDC — вчерашние макс./мин./закрытие</span>
            <span>OR — диапазон первых 15 минут</span>
            <span>PM — премаркет</span>
          </div>
        </div>
        <div className="space-y-4">
          <StatsPanel st={st} price={price} symbol={symbol} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SignalFeed signals={signals} tf={tf} />
        {price ? <RiskCalc key={symbol} price={price} suggestStop={suggestStop} /> : <div className="card p-5" />}
      </div>

      <Scanner symbols={scanSymbols} quotes={quotes} active={symbol} onPick={setSymbol} />

      <p className="text-center text-[11px] text-faint">
        Сигналы — автоматические технические события, не торговые рекомендации. Дэйтрейдинг связан с высоким риском; всегда используйте стоп.
      </p>
    </div>
  );
}
