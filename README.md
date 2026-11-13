# NEON//PULSE — cyberpunk market dashboard

A market dashboard covering stocks, the S&P 500, Bitcoin and gold, with automatic trade ideas. The interface is in Russian.

## What's on it

- **Hero cards**: S&P 500, Bitcoin and gold, each with a 90-day sparkline and 1W / 1M / YTD / 1Y returns.
- **Markets**: Nasdaq 100, Dow, Russell 2000, ETH, SOL, silver, WTI oil, DXY, VIX and the US 10-year yield.
- **Interactive chart** for any selected asset, with SMA50/SMA200 overlays and 1M to 2Y ranges. Next to it is a technical profile: RSI, the 52-week range, volatility and a composite score.
- **Trade ideas**: setups found by rules (breakout of the 52-week high, pullback within an uptrend, golden/death cross, overbought, oversold, downtrend, trend continuation). Each idea comes with an entry, a stop based on the average daily move, a target, R:R and a confidence level.
- **Market regime** (risk-on / risk-off) and the crypto Fear & Greed index.
- **Stock table** (sortable, with search), a sector heatmap, cross-asset returns and a correlation matrix.
- Data refreshes every 60 seconds.

## Live mode

- **Crypto (BTC, ETH, SOL)**: tick prices from the public Binance WebSocket, straight to the browser, refreshed every second.
- **Stocks, indices, gold, oil**: `/api/live` batches Yahoo Finance quotes every 5 seconds (4 s server cache). Prices flash green/red on change and the chart's last point moves live.
- **All US stocks**: a directory of every NYSE / Nasdaq / NYSE American / Arca listing (`/api/symbols`, from Nasdaq Trader, refreshed every 12 h), header search by any ticker or name, full technical analysis for any symbol (`/api/asset`), and day gainers / losers / most active (`/api/movers`).
- **My stocks**: a personal watchlist with live prices and intraday sparklines; add with ☆ (stored in the browser).

The main screen shows only the core markets; everything else lives in collapsible sections: "All US stocks", "Mega-caps", "All markets & macro".

## Charts and day trading

- **Candlestick chart** on every screen with timeframes **1m · 5m · 15m · 1h · 1D · 1W** (minute bars include pre/post-market for US stocks), candles/line toggle, volume, EMA 9/21, VWAP, SMA 50/200 and an RSI pane. The cursor shows OHLC, change and volume; times are in your local time zone.
- **Live candles**: crypto streams from the Binance kline WebSocket (the current candle updates on every trade); stocks, indices and futures refresh the recent window every 3 s (1m) / 5 s (intraday) / 15 s (daily) via `/api/candles`.
- **"⚡ Day trading" mode** (header switch, also `#day` in the URL):
  - day levels on the chart: PDH / PDL / PDC, the 15-minute opening range (OR), premarket high/low (PM);
  - day panel: gap, HOD/LOD, VWAP and distance to it, daily ATR and how much of it is used, relative volume, pivot points;
  - signal feed with chart markers: EMA 9/21 crosses, VWAP breaks/reclaims, opening-range breakouts (ORB), RSI 30/70, new HOD/LOD;
  - position-size calculator (deposit, risk %, entry, stop → quantity and 1R/2R/3R targets);
  - scanner of popular day-trading names plus your watchlist, with a New York clock and countdown to the open/close.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
# or
npm run build && npm start
```

Quotes come from Yahoo Finance (delayed by up to 15 minutes); the Fear & Greed index comes from alternative.me. Both are fetched on the server in `src/app/api/market/route.ts`, and the response is cached for 60 seconds. If the source can't be reached, the dashboard switches to demo data and labels it **DEMO DATA**. `MARKET_DEMO=1` forces demo mode.

It can be deployed to Vercel unchanged, with no keys required.

## Structure

- `src/lib/assets.ts`: list of instruments (add or remove tickers here)
- `src/lib/indicators.ts`: SMA, RSI, volatility, correlations, scoring
- `src/lib/ideas.ts`: idea engine, market regime, correlation matrix
- `src/lib/market.ts`: data loading, caching, demo generator
- `src/components/`: UI components

> Ideas are generated automatically from technical rules and are not investment advice.
