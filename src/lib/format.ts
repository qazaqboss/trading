export function fmtPrice(v: number): string {
  if (!isFinite(v)) return "—";
  const d = v >= 1000 ? 0 : v >= 100 ? 2 : v >= 1 ? 2 : 4;
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
}

export function fmtPct(v: number, digits = 2): string {
  if (!isFinite(v)) return "—";
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits).replace(".", ",")}%`;
}

export function fmtNum(v: number, digits = 0): string {
  if (!isFinite(v)) return "—";
  return v.toFixed(digits).replace(".", ",");
}

export const upDown = (v: number) => (v > 0 ? "text-up" : v < 0 ? "text-down" : "text-muted");

/** Diverging color for heatmaps: red ← neutral → green, scaled by `span` percent. */
export function heatColor(v: number, span = 5): string {
  const t = Math.max(-1, Math.min(1, v / span));
  if (t >= 0) return `rgba(16, 185, 129, ${0.12 + t * 0.68})`;
  return `rgba(244, 63, 94, ${0.12 + -t * 0.68})`;
}

export const CLASS_LABEL: Record<string, string> = {
  index: "Индекс",
  crypto: "Крипто",
  commodity: "Сырьё",
  macro: "Макро",
  stock: "Акция",
};

export const ACCENT: Record<string, string> = {
  "^GSPC": "#60a5fa",
  "BTC-USD": "#f7931a",
  "GC=F": "#facc15",
  "ETH-USD": "#a78bfa",
  "^NDX": "#22d3ee",
};
