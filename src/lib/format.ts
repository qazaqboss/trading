const SUB = "₀₁₂₃₄₅₆₇₈₉";

/** Price with sensible precision: 2 decimals ≥ 1, 4 significant digits below 1,
 *  and DexScreener-style subscript zeros for micro-prices (0.0₇4567). */
export function fmtPrice(v: number): string {
  if (!isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1000) return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: a >= 100000 ? 0 : 2, minimumFractionDigits: a >= 100000 ? 0 : 2 }).format(v);
  if (a >= 1 || a === 0) return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  const zeros = Math.floor(-Math.log10(a)); // leading zeros after the decimal point
  if (zeros >= 6) {
    const digits = Math.round(a * 10 ** (zeros + 4)).toString().slice(0, 4).replace(/0+$/, "") || "0";
    const sub = String(zeros).split("").map((d) => SUB[Number(d)]).join("");
    return `${v < 0 ? "−" : ""}0,0${sub}${digits}`;
  }
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: zeros + 4, maximumFractionDigits: zeros + 4 }).format(v);
}

/** Compact large amounts in Russian: 1,23 трлн / 456,7 млрд / 12,3 млн / 45,6 тыс. */
export function fmtBig(v: number, prefix = ""): string {
  if (!isFinite(v) || v === 0) return "—";
  const a = Math.abs(v);
  const f = (x: number, d: number) => x.toFixed(d).replace(".", ",");
  const s = a >= 1e12 ? `${f(a / 1e12, 2)} трлн` : a >= 1e9 ? `${f(a / 1e9, 2)} млрд` : a >= 1e6 ? `${f(a / 1e6, 2)} млн` : a >= 1e3 ? `${f(a / 1e3, 1)} тыс.` : f(a, 0);
  return `${v < 0 ? "−" : ""}${prefix}${s}`;
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
