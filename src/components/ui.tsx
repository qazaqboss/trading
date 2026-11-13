"use client";

import { useId, type ReactNode } from "react";
import { fmtPct, upDown } from "@/lib/format";

export function Sparkline({
  data,
  width = 120,
  height = 36,
  color,
  fill = true,
  responsive = false,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  responsive?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  if (data.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * width, height - 2 - ((v - min) / span) * (height - 4)]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const c = color ?? (data[data.length - 1] >= data[0] ? "var(--color-up)" : "var(--color-down)");
  return (
    <svg
      width={responsive ? "100%" : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="overflow-visible"
      aria-hidden
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={c} stopOpacity="0.35" />
              <stop offset="100%" stopColor={c} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${d}L${width},${height}L0,${height}Z`} fill={`url(#${id})`} />
        </>
      )}
      <path d={d} fill="none" stroke={c} strokeWidth="1.6" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 3px ${c})` }} />
    </svg>
  );
}

export function Change({ v, className = "", digits = 2 }: { v: number; className?: string; digits?: number }) {
  return <span className={`tnum ${upDown(v)} ${className}`}>{fmtPct(v, digits)}</span>;
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "up" | "down" | "warn" | "neutral" | "brand" }) {
  const tones = {
    up: "bg-up/15 text-up ring-up/30",
    down: "bg-down/15 text-down ring-down/30",
    warn: "bg-warn/15 text-warn ring-warn/30",
    brand: "bg-brand/20 text-brand ring-brand/40",
    neutral: "bg-white/5 text-muted ring-white/10",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold tracking-wider uppercase ring-1 ring-inset ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function TrendPill({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up") return <Pill tone="up">▲ Аптренд</Pill>;
  if (trend === "down") return <Pill tone="down">▼ Даунтренд</Pill>;
  return <Pill>◆ Боковик</Pill>;
}

export function ScorePill({ score }: { score: number }) {
  const label = score >= 50 ? "Сильная покупка" : score >= 15 ? "Покупка" : score > -15 ? "Нейтрально" : score > -50 ? "Продажа" : "Сильная продажа";
  const tone = score >= 15 ? "up" : score <= -15 ? "down" : "neutral";
  return <Pill tone={tone}>{label}</Pill>;
}

export function RsiBar({ v }: { v: number }) {
  const color = v >= 70 ? "var(--color-down)" : v <= 30 ? "var(--color-up)" : "var(--color-brand)";
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 w-16 rounded-full bg-white/10">
        <div className="absolute inset-y-0 left-[30%] right-[30%] bg-white/5" />
        <div className="absolute top-1/2 h-2.5 w-1 -translate-y-1/2 rounded" style={{ left: `calc(${v}% - 2px)`, background: color }} />
      </div>
      <span className="tnum w-6 text-xs text-muted">{v.toFixed(0)}</span>
    </div>
  );
}

export function RangeBar({ low, high, value }: { low: number; high: number; value: number }) {
  const pos = high > low ? ((value - low) / (high - low)) * 100 : 50;
  return (
    <div className="relative h-1.5 w-full rounded-full bg-gradient-to-r from-down/50 via-white/15 to-up/50">
      <div
        className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-ink shadow"
        style={{ left: `${Math.max(0, Math.min(100, pos))}%` }}
      />
    </div>
  );
}

/** Semicircle gauge for 0..100 (or -100..100 when `signed`). */
export function Gauge({ value, signed = false, size = 180, label }: { value: number; signed?: boolean; size?: number; label?: string }) {
  const t = signed ? (value + 100) / 200 : value / 100;
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  const angle = Math.PI * (1 - Math.max(0, Math.min(1, t)));
  const nx = cx + r * Math.cos(angle);
  const ny = cy - r * Math.sin(angle);
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const gid = `gg${size}${signed ? "s" : ""}`;
  return (
    <svg width={size} height={size / 2 + 14} viewBox={`0 0 ${size} ${size / 2 + 14}`} role="img" aria-label={label}>
      <defs>
        <linearGradient id={gid}>
          <stop offset="0%" stopColor="#ff2a6d" />
          <stop offset="50%" stopColor="#d300c5" />
          <stop offset="100%" stopColor="#05d9e8" />
        </linearGradient>
      </defs>
      <path d={arc} stroke="rgba(255,255,255,0.08)" strokeWidth="12" fill="none" strokeLinecap="round" />
      <path d={arc} stroke={`url(#${gid})`} strokeWidth="12" fill="none" strokeLinecap="round" opacity="0.9" />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#ffffff" strokeWidth="3" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 4px #05d9e8)" }} />
      <circle cx={cx} cy={cy} r="6" fill="#05d9e8" />
    </svg>
  );
}

export function SectionTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="neon-text text-sm font-bold">{title}</h2>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-[2px] bg-white/5 p-0.5 ring-1 ring-white/10">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-[2px] px-2.5 py-1 text-xs font-medium transition ${
            value === o.value ? "bg-brand text-black shadow-[0_0_12px_rgba(5,217,232,0.7)]" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
