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

## Finviz fundamentals and live news

- **Fundamentals for any US stock** (`/api/fundamentals?symbol=`): the full Finviz snapshot — P/E, Forward P/E, PEG, P/S, P/B, P/FCF, EV/EBITDA, EPS (ttm / next Q / next Y / growth), margins, ROA/ROE/ROIC, debt and liquidity, dividends, insider/institutional ownership, short float, analyst target and rating, and more. Shown grouped in Russian, with an "All metrics" toggle. Scraping follows the selectors of the open-source [lit26/finvizfinance](https://github.com/lit26/finvizfinance) (`table.snapshot-table2`, `table.fullview-news-outer`). If Finviz blocks the request, it falls back to Yahoo `quoteSummary` (cookie + crumb, as yfinance does).
- **Ticker news** (`/api/news?symbol=`): from Finviz (Reuters, Bloomberg, Benzinga…), falling back to Yahoo; refreshed every minute, new items get a NEW tag.
- **Market news feed** (`/api/news`): Finviz News + CNBC, MarketWatch, Yahoo Finance, Investing.com and Cointelegraph RSS, de-duplicated and sorted by time, refreshed every minute, with source and text filters.
- In day-trading mode: a compact Finviz block (float, short float, relative volume, earnings date) and the active ticker's news.

## Crypto page (`/crypto`)

A separate page covering every coin listed on CoinGecko (17,000+), meme coins included:

- **Coin table** with logos, price, 1h/24h/7d change, volume, market cap and a 7-day sparkline; 100 coins per page across every page, plus jump-to-page.
- **Categories**: All, 🐸 Meme coins, Solana memes, Layer 1, DeFi, AI, GameFi, Stablecoins, ★ Favourites.
- **Live prices**: one Binance `!miniTicker@arr` WebSocket updates every USDT pair (~400 coins) every second; the rest refresh from CoinGecko every minute. Live coins are marked with a green dot.
- **Market header**: total market cap, 24h volume, BTC/ETH dominance, number of coins, fear & greed index. Also trending coins on CoinGecko and the day's top gainers and losers.
- **Search across all coins** (CoinGecko `/search`).
- **Coin page** (`/crypto#coin=pepe`, shareable link):
  - live chart with timeframes 1m–1W from Binance, or CoinGecko candles for coins without a Binance pair;
  - market cap, FDV, volume, supply (circulating / total / max), ATH/ATL with dates;
  - changes over 1h–1y, project links, contracts (copy on click), description and news.
- Micro-prices display correctly (`0,000007100`, `0,0₈4567`), and the chart's price scale picks its precision automatically.
- CoinGecko is called directly from the browser; when it hits the rate limit, the call goes through `/api/crypto` with a shared server cache.

## Install on your phone (PWA)

The site is an installable web app: `src/app/manifest.ts`, icons in `public/icons` plus `src/app/apple-icon.png`, and a service worker in `public/sw.js` (it caches only the app shell; quotes in `/api/*` are never cached).

- **Android (Chrome)**: the "📲 Add to Home screen" button at the bottom of the page opens the system install dialog, or use menu ⋮ → "Install app".
- **iPhone/iPad (Safari)**: Share ⬆ → "Add to Home Screen" → "Add". The button shows these steps.
- **Desktop (Chrome/Edge)**: the install icon in the address bar.

The app opens full-screen without the address bar, with quick shortcuts to "Day trading" and "Market overview".

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
