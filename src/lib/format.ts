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
  if (t >= 0) return `rgba(0, 255, 159, ${0.12 + t * 0.68})`;
  return `rgba(255, 42, 109, ${0.12 + -t * 0.68})`;
}

export const CLASS_LABEL: Record<string, string> = {
  index: "Индекс",
  crypto: "Крипто",
  commodity: "Сырьё",
  macro: "Макро",
  stock: "Акция",
};

export const ACCENT: Record<string, string> = {
  "^GSPC": "#05d9e8",
  "BTC-USD": "#ff7b00",
  "GC=F": "#f9f002",
  "ETH-USD": "#d300c5",
  "^NDX": "#00ff9f",
};
