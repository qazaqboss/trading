"use client";

import { useEffect, useRef, useState } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  TickMarkType,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesType,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { fmtPct, fmtPrice } from "@/lib/format";
import { emaSeries, isIntraday, rsiSeries, smaSeriesN, vwapSeries, type TradeSignal } from "@/lib/ta";
import type { Candle, Timeframe } from "@/lib/types";

export interface Indicators {
  volume: boolean;
  ema: boolean; // EMA 9 / 21
  vwap: boolean;
  sma: boolean; // SMA 50 / 200
  rsi: boolean;
}

export interface Level {
  price: number;
  title: string;
  color: string;
}

const C = {
  up: "#00ff9f",
  down: "#ff2a6d",
  ema9: "#05d9e8",
  ema21: "#f9f002",
  vwap: "#ff7b00",
  sma50: "#d300c5",
  sma200: "#ffffff",
  grid: "rgba(211,0,197,0.10)",
  text: "#7fd8e6",
};

const fmtTime = (t: number, tf: Timeframe) =>
  new Date(t * 1000).toLocaleString("ru-RU", isIntraday(tf) ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short", year: "numeric" });

export default function TradingChart({
  candles,
  symbol,
  tf,
  mode = "candles",
  ind,
  levels = [],
  signals = [],
  height = 460,
}: {
  candles: Candle[];
  symbol: string;
  tf: Timeframe;
  mode?: "candles" | "line";
  ind: Indicators;
  levels?: Level[];
  signals?: TradeSignal[];
  height?: number;
}) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<Record<string, ISeriesApi<SeriesType>>>({});
  const markers = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const lines = useRef<IPriceLine[]>([]);
  const fit = useRef(true);
  const prev = useRef<{ first: number; len: number }>({ first: 0, len: 0 });
  const candlesRef = useRef(candles);
  const [hover, setHover] = useState<Candle | null>(null);

  // chart instance
  useEffect(() => {
    if (!el.current) return;
    const c = createChart(el.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: C.text,
        fontFamily: '"Share Tech Mono", ui-monospace, monospace',
        attributionLogo: false,
        panes: { separatorColor: "rgba(5,217,232,0.25)" },
      },
      grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
      crosshair: {
        mode: CrosshairMode.Normal,
        horzLine: { labelBackgroundColor: "#3a0d4f" },
        vertLine: { labelBackgroundColor: "#3a0d4f" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, rightOffset: 6 },
    });
    chart.current = c;
    c.subscribeCrosshairMove((p) => {
      if (!p.time) return setHover(null);
      const t = p.time as number;
      setHover(candlesRef.current.find((x) => x.t === t) ?? null);
    });
    return () => {
      c.remove();
      chart.current = null;
      series.current = {};
      markers.current = null;
      lines.current = [];
    };
  }, []);

  // local-time axis labels
  useEffect(() => {
    chart.current?.applyOptions({
      localization: { locale: "ru-RU", timeFormatter: (t: Time) => fmtTime(t as number, tf), priceFormatter: (p: number) => fmtPrice(p) },
      timeScale: {
        timeVisible: isIntraday(tf),
        secondsVisible: false,
        tickMarkFormatter: (t: Time, type: TickMarkType) => {
          const d = new Date((t as number) * 1000);
          if (type === TickMarkType.Year) return String(d.getFullYear());
          if (type === TickMarkType.Month) return d.toLocaleString("ru-RU", { month: "short" });
          if (type === TickMarkType.DayOfMonth) return d.toLocaleString("ru-RU", { day: "numeric", month: "short" });
          return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
        },
      },
    });
  }, [tf]);

  // (re)build series when the layout changes
  const layoutKey = `${symbol}|${tf}|${mode}|${ind.volume}|${ind.ema}|${ind.vwap}|${ind.sma}|${ind.rsi}`;
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    Object.values(series.current).forEach((s) => c.removeSeries(s));
    series.current = {};
    markers.current = null;
    lines.current = [];
    const s = series.current;
    const line = (color: string, width: 1 | 2 = 1, style: LineStyle = LineStyle.Solid) =>
      c.addSeries(LineSeries, { color, lineWidth: width, lineStyle: style, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });

    s.main =
      mode === "candles"
        ? c.addSeries(CandlestickSeries, {
            upColor: C.up,
            downColor: C.down,
            borderUpColor: C.up,
            borderDownColor: C.down,
            wickUpColor: C.up,
            wickDownColor: C.down,
          })
        : c.addSeries(AreaSeries, { lineColor: C.ema9, topColor: "rgba(5,217,232,0.35)", bottomColor: "rgba(5,217,232,0)", lineWidth: 2 });
    c.priceScale("right").applyOptions({ scaleMargins: { top: 0.08, bottom: ind.volume ? 0.22 : 0.06 } });
    if (ind.volume) {
      s.vol = c.addSeries(HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
      c.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    }
    if (ind.ema) {
      s.ema9 = line(C.ema9);
      s.ema21 = line(C.ema21);
    }
    if (ind.vwap) s.vwap = line(C.vwap, 2);
    if (ind.sma) {
      s.sma50 = line(C.sma50);
      s.sma200 = line(C.sma200, 1, LineStyle.Dashed);
    }
    if (ind.rsi) {
      s.rsi = c.addSeries(LineSeries, { color: "#d300c5", lineWidth: 1, priceLineVisible: false, lastValueVisible: true }, 1);
      s.rsi.createPriceLine({ price: 70, color: C.down, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false, title: "" });
      s.rsi.createPriceLine({ price: 30, color: C.up, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false, title: "" });
      c.panes()[1]?.setStretchFactor(0.28);
    }
    markers.current = createSeriesMarkers(s.main as ISeriesApi<"Candlestick">, []);
    fit.current = true;
    prev.current = { first: 0, len: 0 };
  }, [layoutKey, ind.volume, ind.ema, ind.vwap, ind.sma, ind.rsi, mode]);

  // data
  useEffect(() => {
    candlesRef.current = candles;
    const s = series.current;
    const c = chart.current;
    if (!c || !s.main || !candles.length) return;
    const T = (t: number) => t as UTCTimestamp;
    const closes = candles.map((x) => x.c);
    const pt = (arr: number[]) => candles.map((x, i) => ({ time: T(x.t), value: arr[i] })).filter((p) => isFinite(p.value));
    const volData = () =>
      candles.map((x) => ({ time: T(x.t), value: x.v, color: x.c >= x.o ? "rgba(0,255,159,0.35)" : "rgba(255,42,109,0.35)" }));
    const mainData = () =>
      mode === "candles" ? candles.map((x) => ({ time: T(x.t), open: x.o, high: x.h, low: x.l, close: x.c })) : candles.map((x) => ({ time: T(x.t), value: x.c }));

    const sameHead = prev.current.first === candles[0].t && candles.length - prev.current.len <= 1 && candles.length >= prev.current.len;
    const ema9 = ind.ema ? emaSeries(closes, 9) : [];
    const ema21 = ind.ema ? emaSeries(closes, 21) : [];
    const vw = ind.vwap ? vwapSeries(candles, symbol) : [];
    const s50 = ind.sma ? smaSeriesN(closes, 50) : [];
    const s200 = ind.sma ? smaSeriesN(closes, 200) : [];
    const rsi = ind.rsi ? rsiSeries(closes, 14) : [];

    if (sameHead && prev.current.len > 0) {
      // live tick: only touch the last bar
      const i = candles.length - 1;
      const x = candles[i];
      const t = T(x.t);
      s.main.update(mode === "candles" ? { time: t, open: x.o, high: x.h, low: x.l, close: x.c } : { time: t, value: x.c });
      s.vol?.update({ time: t, value: x.v, color: x.c >= x.o ? "rgba(0,255,159,0.35)" : "rgba(255,42,109,0.35)" });
      const up = (k: string, arr: number[]) => s[k] && isFinite(arr[i]) && s[k].update({ time: t, value: arr[i] });
      up("ema9", ema9);
      up("ema21", ema21);
      up("vwap", vw);
      up("sma50", s50);
      up("sma200", s200);
      up("rsi", rsi);
    } else {
      s.main.setData(mainData());
      s.vol?.setData(volData());
      s.ema9?.setData(pt(ema9));
      s.ema21?.setData(pt(ema21));
      s.vwap?.setData(pt(vw));
      s.sma50?.setData(pt(s50));
      s.sma200?.setData(pt(s200));
      s.rsi?.setData(pt(rsi));
    }
    prev.current = { first: candles[0].t, len: candles.length };

    if (fit.current) {
      fit.current = false;
      const show = isIntraday(tf) ? 160 : 180;
      c.timeScale().setVisibleLogicalRange({ from: Math.max(0, candles.length - show), to: candles.length + 5 });
    }
  }, [candles, symbol, tf, mode, ind, layoutKey]);

  // price levels
  useEffect(() => {
    const main = series.current.main;
    if (!main) return;
    lines.current.forEach((l) => main.removePriceLine(l));
    lines.current = levels
      .filter((l) => isFinite(l.price))
      .map((l) =>
        main.createPriceLine({ price: l.price, color: l.color, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: l.title }),
      );
  }, [levels, layoutKey]);

  // signal markers
  useEffect(() => {
    markers.current?.setMarkers(
      signals.map((s) => ({
        time: s.t as UTCTimestamp,
        position: s.dir === "up" ? "belowBar" : "aboveBar",
        color: s.dir === "up" ? C.up : C.down,
        shape: s.dir === "up" ? "arrowUp" : "arrowDown",
        text: { ema: "EMA", vwap: "VWAP", orb: "ORB", rsi: "RSI", hod: "HOD", lod: "LOD" }[s.kind],
      })),
    );
  }, [signals, layoutKey]);

  const bar = hover ?? candles[candles.length - 1];
  const prevBar = bar ? candles[candles.findIndex((x) => x.t === bar.t) - 1] : undefined;
  return (
    <div className="relative">
      {bar && (
        <div className="tnum pointer-events-none absolute top-1 left-2 z-10 flex flex-wrap gap-x-3 text-[11px] text-muted">
          <span className="text-faint">{fmtTime(bar.t, tf)}</span>
          <span>O <b className="text-ink">{fmtPrice(bar.o)}</b></span>
          <span>H <b className="text-up">{fmtPrice(bar.h)}</b></span>
          <span>L <b className="text-down">{fmtPrice(bar.l)}</b></span>
          <span>C <b className="text-ink">{fmtPrice(bar.c)}</b></span>
          {prevBar && <span className={bar.c >= prevBar.c ? "text-up" : "text-down"}>{fmtPct((bar.c / prevBar.c - 1) * 100)}</span>}
          {bar.v > 0 && <span>V <b className="text-ink">{new Intl.NumberFormat("ru-RU", { notation: "compact" }).format(bar.v)}</b></span>}
        </div>
      )}
      <div ref={el} style={{ height }} className="w-full" />
    </div>
  );
}
