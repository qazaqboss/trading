import type { AssetDef } from "./types";

export const MARKETS: AssetDef[] = [
  { symbol: "^GSPC", ticker: "S&P 500", name: "S&P 500", cls: "index", tv: "SP:SPX" },
  { symbol: "^NDX", ticker: "NDX", name: "Nasdaq 100", cls: "index", tv: "NASDAQ:NDX" },
  { symbol: "^DJI", ticker: "DJIA", name: "Dow Jones", cls: "index", tv: "DJ:DJI" },
  { symbol: "^RUT", ticker: "RUT", name: "Russell 2000", cls: "index", tv: "TVC:RUT" },
  { symbol: "BTC-USD", ticker: "BTC", name: "Биткоин", cls: "crypto", tv: "BITSTAMP:BTCUSD" },
  { symbol: "ETH-USD", ticker: "ETH", name: "Ethereum", cls: "crypto", tv: "BITSTAMP:ETHUSD" },
  { symbol: "SOL-USD", ticker: "SOL", name: "Solana", cls: "crypto", tv: "COINBASE:SOLUSD" },
  { symbol: "GC=F", ticker: "GOLD", name: "Золото", cls: "commodity", tv: "TVC:GOLD" },
  { symbol: "SI=F", ticker: "SILVER", name: "Серебро", cls: "commodity", tv: "TVC:SILVER" },
  { symbol: "CL=F", ticker: "WTI", name: "Нефть WTI", cls: "commodity", tv: "TVC:USOIL" },
  { symbol: "DX-Y.NYB", ticker: "DXY", name: "Индекс доллара", cls: "macro", tv: "TVC:DXY" },
  { symbol: "^VIX", ticker: "VIX", name: "Индекс страха VIX", cls: "macro", tv: "TVC:VIX" },
  { symbol: "^TNX", ticker: "US10Y", name: "Доходность 10Y", cls: "macro", tv: "TVC:US10Y" },
];

export const STOCKS: AssetDef[] = [
  { symbol: "AAPL", ticker: "AAPL", name: "Apple", cls: "stock", sector: "Технологии" },
  { symbol: "MSFT", ticker: "MSFT", name: "Microsoft", cls: "stock", sector: "Технологии" },
  { symbol: "NVDA", ticker: "NVDA", name: "NVIDIA", cls: "stock", sector: "Полупроводники" },
  { symbol: "AVGO", ticker: "AVGO", name: "Broadcom", cls: "stock", sector: "Полупроводники" },
  { symbol: "AMD", ticker: "AMD", name: "AMD", cls: "stock", sector: "Полупроводники" },
  { symbol: "GOOGL", ticker: "GOOGL", name: "Alphabet", cls: "stock", sector: "Коммуникации" },
  { symbol: "META", ticker: "META", name: "Meta", cls: "stock", sector: "Коммуникации" },
  { symbol: "NFLX", ticker: "NFLX", name: "Netflix", cls: "stock", sector: "Коммуникации" },
  { symbol: "AMZN", ticker: "AMZN", name: "Amazon", cls: "stock", sector: "Потребительский" },
  { symbol: "TSLA", ticker: "TSLA", name: "Tesla", cls: "stock", sector: "Потребительский" },
  { symbol: "COST", ticker: "COST", name: "Costco", cls: "stock", sector: "Потребительский" },
  { symbol: "WMT", ticker: "WMT", name: "Walmart", cls: "stock", sector: "Потребительский" },
  { symbol: "JPM", ticker: "JPM", name: "JPMorgan", cls: "stock", sector: "Финансы" },
  { symbol: "V", ticker: "V", name: "Visa", cls: "stock", sector: "Финансы" },
  { symbol: "BRK-B", ticker: "BRK.B", name: "Berkshire", cls: "stock", sector: "Финансы" },
  { symbol: "LLY", ticker: "LLY", name: "Eli Lilly", cls: "stock", sector: "Здравоохранение" },
  { symbol: "UNH", ticker: "UNH", name: "UnitedHealth", cls: "stock", sector: "Здравоохранение" },
  { symbol: "XOM", ticker: "XOM", name: "Exxon Mobil", cls: "stock", sector: "Энергетика" },
  { symbol: "PLTR", ticker: "PLTR", name: "Palantir", cls: "stock", sector: "Технологии" },
  { symbol: "COIN", ticker: "COIN", name: "Coinbase", cls: "stock", sector: "Крипто-акции" },
  { symbol: "MSTR", ticker: "MSTR", name: "Strategy", cls: "stock", sector: "Крипто-акции" },
];

export const ALL_ASSETS: AssetDef[] = [...MARKETS, ...STOCKS];

/** Assets used in the cross-asset correlation matrix. */
export const CORR_SYMBOLS = ["^GSPC", "^NDX", "BTC-USD", "ETH-USD", "GC=F", "CL=F", "DX-Y.NYB", "^TNX"];

/** Approximate starting levels for the offline demo generator. */
export const DEMO_BASE: Record<string, { p: number; vol: number; drift: number }> = {
  "^GSPC": { p: 6700, vol: 0.16, drift: 0.12 },
  "^NDX": { p: 24500, vol: 0.21, drift: 0.16 },
  "^DJI": { p: 46500, vol: 0.14, drift: 0.08 },
  "^RUT": { p: 2450, vol: 0.22, drift: 0.04 },
  "BTC-USD": { p: 98000, vol: 0.5, drift: 0.2 },
  "ETH-USD": { p: 3400, vol: 0.65, drift: 0.05 },
  "SOL-USD": { p: 170, vol: 0.8, drift: 0.1 },
  "GC=F": { p: 4100, vol: 0.17, drift: 0.3 },
  "SI=F": { p: 50, vol: 0.3, drift: 0.35 },
  "CL=F": { p: 61, vol: 0.32, drift: -0.12 },
  "DX-Y.NYB": { p: 99.5, vol: 0.07, drift: -0.06 },
  "^VIX": { p: 17, vol: 0.9, drift: 0 },
  "^TNX": { p: 4.1, vol: 0.2, drift: -0.05 },
  AAPL: { p: 270, vol: 0.26, drift: 0.1 },
  MSFT: { p: 505, vol: 0.24, drift: 0.14 },
  NVDA: { p: 190, vol: 0.45, drift: 0.35 },
  AVGO: { p: 350, vol: 0.42, drift: 0.4 },
  AMD: { p: 245, vol: 0.5, drift: 0.45 },
  GOOGL: { p: 280, vol: 0.3, drift: 0.4 },
  META: { p: 610, vol: 0.35, drift: 0.05 },
  NFLX: { p: 1100, vol: 0.33, drift: 0.15 },
  AMZN: { p: 240, vol: 0.31, drift: 0.1 },
  TSLA: { p: 420, vol: 0.6, drift: 0.2 },
  COST: { p: 910, vol: 0.2, drift: -0.05 },
  WMT: { p: 102, vol: 0.2, drift: 0.12 },
  JPM: { p: 305, vol: 0.24, drift: 0.18 },
  V: { p: 335, vol: 0.2, drift: 0.02 },
  "BRK-B": { p: 495, vol: 0.17, drift: -0.02 },
  LLY: { p: 920, vol: 0.32, drift: 0.15 },
  UNH: { p: 330, vol: 0.4, drift: -0.3 },
  XOM: { p: 115, vol: 0.22, drift: 0.02 },
  PLTR: { p: 180, vol: 0.65, drift: 0.6 },
  COIN: { p: 310, vol: 0.75, drift: 0.1 },
  MSTR: { p: 240, vol: 0.85, drift: -0.35 },
};
