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

## iPhone widget (`/widget`)

iOS lets only apps put widgets on the home screen, so the widget runs through the free [Scriptable](https://scriptable.app) app:

1. On `/widget`, choose tickers (presets: markets, crypto, mega-caps, "My stocks") and look at the live preview in small / medium / large size.
2. Tap "Copy script" (or "Download NeonPulse.js"). The site address and tickers are already filled in.
3. In Scriptable, tap ＋, paste, name it `NeonPulse`.
4. Home screen → ＋ → Scriptable → pick a size → Script: NeonPulse. The **Parameter** field can override the tickers (`NVDA, TSLA, BTC-USD`).

- Sizes: small (one ticker large with a chart + a second line), medium (4), large (9), extra large on iPad (12), and lock-screen widgets (line, circle, rectangle).
- Data: `/api/widget?symbols=…` (prices, day change, intraday sparkline, NYSE session). The script caches the last response and shows ⚠ when offline.
- Refresh: the script asks for every 5 minutes, but iOS decides the actual timing (usually 5–15 minutes). Tapping the widget opens the dashboard.

## IPOs and new tickers

The list of tickers updates on its own; you don't need to add anything by hand:

- **Directory of all US stocks** = Nasdaq Trader + the GitHub repo [rreichel3/US-Stock-Symbols](https://github.com/rreichel3/US-Stock-Symbols) (updated every night by GitHub Actions; covers every NASDAQ/NYSE/AMEX listing with market cap, sector and IPO year). The server re-reads it every 6–12 h, so new listings show up in search and in "All US stocks" automatically. The directory has an "IPO <year>" filter, and fresh listings get a badge.
- **"IPO and new tickers" panel** (`/api/ipo`) on the main screen:
  - **Upcoming**: date and days remaining, expected price range, number of shares, deal size;
  - **Priced**: offer price, current price and change since the IPO;
  - **Filings** (S-1 filed);
  - **New tickers**: everything added over the last 7 days, from the git history of the same repo (SPAC warrants and units are hidden);
  - **IPO <year>**: every company listed this year, largest market cap first.
- IPO calendar sources: the Nasdaq IPO calendar, falling back to Yahoo (the same `ipo_info` request yfinance sends, github.com/ranaroussi/yfinance).
- **Brand-new tickers**: if Yahoo doesn't know a stock yet, price and history are taken from the Nasdaq API. History of even a few days is enough to open it (the 30-day minimum is gone). If the ticker isn't trading yet, you get its IPO date and price range instead of an error.

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
