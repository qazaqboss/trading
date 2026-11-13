export type AssetClass = "index" | "crypto" | "commodity" | "macro" | "stock";

export interface AssetDef {
  symbol: string; // Yahoo Finance symbol
  ticker: string; // short display ticker
  name: string;
  cls: AssetClass;
  sector?: string;
  tv?: string; // TradingView symbol for the interactive chart
}

export interface Bar {
  t: string; // YYYY-MM-DD
  c: number;
}

export interface Metrics {
  price: number;
  ch1d: number;
  ch1w: number;
  ch1m: number;
  ch3m: number;
  chYtd: number;
  ch1y: number;
  high52: number;
  low52: number;
  fromHigh: number; // % below 52w high (negative)
  rsi14: number;
  sma20: number;
  sma50: number;
  sma200: number;
  vol30: number; // annualized volatility, %
  atr: number; // average absolute daily move, price units
  cross: "golden" | "death" | null; // SMA50/200 cross in the last 15 sessions
  trend: "up" | "down" | "flat";
  score: number; // -100..100 composite technical score
}

export interface Asset extends AssetDef {
  history: Bar[];
  m: Metrics;
}

export type Direction = "LONG" | "SHORT" | "WATCH";

export interface Idea {
  id: string;
  symbol: string;
  ticker: string;
  name: string;
  cls: AssetClass;
  direction: Direction;
  setup: string;
  confidence: number; // 0..100
  horizon: string;
  entry: number;
  stop: number;
  target: number;
  rr: number;
  reasons: string[];
}

export interface Regime {
  score: number; // -100 (risk-off) .. 100 (risk-on)
  label: string;
  notes: string[];
}

export interface FearGreed {
  value: number;
  label: string;
  history: number[];
}

export interface MarketPayload {
  updatedAt: string;
  source: "live" | "demo";
  errors: string[];
  assets: Asset[];
  ideas: Idea[];
  regime: Regime;
  correlation: { labels: string[]; matrix: number[][] };
  fearGreed: FearGreed | null;
}
