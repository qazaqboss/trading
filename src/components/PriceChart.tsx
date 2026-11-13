"use client";

import { useEffect, useRef } from "react";
import { AreaSeries, ColorType, LineSeries, LineStyle, createChart, type IChartApi } from "lightweight-charts";
import { smaSeries } from "@/lib/indicators";
import type { Bar } from "@/lib/types";

export type Range = "1M" | "3M" | "6M" | "1Y" | "2Y";
const RANGE_DAYS: Record<Range, number> = { "1M": 31, "3M": 92, "6M": 183, "1Y": 366, "2Y": 731 };

export default function PriceChart({ history, color, range }: { history: Bar[]; color: string; range: Range }) {
  const el = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!el.current) return;
    const chart = createChart(el.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8b97b0",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        attributionLogo: false,
      },
      grid: { vertLines: { color: "rgba(28,39,64,0.5)" }, horzLines: { color: "rgba(28,39,64,0.5)" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: { horzLine: { labelBackgroundColor: "#1c2740" }, vertLine: { labelBackgroundColor: "#1c2740" } },
      localization: { locale: "ru-RU" },
    });
    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !history.length) return;
    const closes = history.map((b) => b.c);
    const s50 = smaSeries(closes, 50);
    const s200 = smaSeries(closes, 200);
    const last = new Date(history[history.length - 1].t);
    last.setDate(last.getDate() - RANGE_DAYS[range]);
    const from = last.toISOString().slice(0, 10);
    const idx = history.findIndex((b) => b.t >= from);
    const slice = (arr: number[]) =>
      history.map((b, i) => ({ time: b.t, value: arr[i] })).slice(idx).filter((p) => isFinite(p.value));

    const area = chart.addSeries(AreaSeries, {
      lineColor: color,
      topColor: `${color}55`,
      bottomColor: `${color}00`,
      lineWidth: 2,
      priceLineColor: color,
    });
    area.setData(slice(closes));
    const l50 = chart.addSeries(LineSeries, {
      color: "#a78bfa",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    l50.setData(slice(s50));
    const l200 = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    l200.setData(slice(s200));
    chart.timeScale().fitContent();
    return () => {
      chart.removeSeries(area);
      chart.removeSeries(l50);
      chart.removeSeries(l200);
    };
  }, [history, color, range]);

  return <div ref={el} className="h-[340px] w-full" />;
}
