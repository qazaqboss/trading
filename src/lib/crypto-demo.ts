import "server-only";

/** Offline placeholder data (clearly marked DEMO in the UI). Prices are rough snapshots, not live. */
const COINS: [string, string, string, number, number, string[]][] = [
  // id, symbol, name, price, market cap (USD), tags
  ["bitcoin", "btc", "Bitcoin", 97900, 1.94e12, ["layer-1"]],
  ["ethereum", "eth", "Ethereum", 3400, 4.1e11, ["layer-1", "decentralized-finance-defi"]],
  ["tether", "usdt", "Tether", 1, 1.8e11, ["stablecoins"]],
  ["ripple", "xrp", "XRP", 2.35, 1.4e11, ["layer-1"]],
  ["binancecoin", "bnb", "BNB", 910, 1.3e11, ["layer-1"]],
  ["solana", "sol", "Solana", 170, 9.2e10, ["layer-1"]],
  ["usd-coin", "usdc", "USDC", 1, 7.5e10, ["stablecoins"]],
  ["dogecoin", "doge", "Dogecoin", 0.19, 2.85e10, ["meme-token"]],
  ["tron", "trx", "TRON", 0.29, 2.7e10, ["layer-1"]],
  ["cardano", "ada", "Cardano", 0.62, 2.2e10, ["layer-1"]],
  ["chainlink", "link", "Chainlink", 15.2, 1.0e10, ["decentralized-finance-defi"]],
  ["avalanche-2", "avax", "Avalanche", 19.5, 8.2e9, ["layer-1"]],
  ["shiba-inu", "shib", "Shiba Inu", 0.0000118, 6.9e9, ["meme-token"]],
  ["sui", "sui", "Sui", 2.4, 8.4e9, ["layer-1"]],
  ["the-open-network", "ton", "Toncoin", 2.1, 5.3e9, ["layer-1"]],
  ["pepe", "pepe", "Pepe", 0.0000071, 3.0e9, ["meme-token"]],
  ["uniswap", "uni", "Uniswap", 7.8, 4.9e9, ["decentralized-finance-defi"]],
  ["near", "near", "NEAR Protocol", 2.6, 3.3e9, ["layer-1", "artificial-intelligence"]],
  ["official-trump", "trump", "Official Trump", 7.4, 1.5e9, ["meme-token", "solana-meme-coins"]],
  ["aave", "aave", "Aave", 210, 3.2e9, ["decentralized-finance-defi"]],
  ["bittensor", "tao", "Bittensor", 380, 3.6e9, ["artificial-intelligence"]],
  ["render-token", "render", "Render", 2.9, 1.5e9, ["artificial-intelligence"]],
  ["bonk", "bonk", "Bonk", 0.0000135, 1.1e9, ["meme-token", "solana-meme-coins"]],
  ["dogwifcoin", "wif", "dogwifhat", 0.55, 5.5e8, ["meme-token", "solana-meme-coins"]],
  ["floki", "floki", "FLOKI", 0.000072, 6.9e8, ["meme-token"]],
  ["fartcoin", "fartcoin", "Fartcoin", 0.31, 3.1e8, ["meme-token", "solana-meme-coins"]],
  ["pudgy-penguins", "pengu", "Pudgy Penguins", 0.016, 1.0e9, ["meme-token"]],
  ["spx6900", "spx", "SPX6900", 0.72, 6.7e8, ["meme-token"]],
  ["popcat", "popcat", "Popcat", 0.14, 1.4e8, ["meme-token", "solana-meme-coins"]],
  ["brett", "brett", "Brett", 0.028, 2.8e8, ["meme-token"]],
  ["mog-coin", "mog", "Mog Coin", 0.00000041, 1.6e8, ["meme-token"]],
  ["turbo", "turbo", "Turbo", 0.0022, 1.5e8, ["meme-token"]],
  ["axie-infinity", "axs", "Axie Infinity", 1.4, 2.3e8, ["gaming"]],
  ["immutable-x", "imx", "Immutable", 0.45, 8.9e8, ["gaming"]],
  ["the-sandbox", "sand", "The Sandbox", 0.2, 5.0e8, ["gaming"]],
  ["fetch-ai", "fet", "Artificial Superintelligence Alliance", 0.32, 7.5e8, ["artificial-intelligence"]],
  ["dai", "dai", "Dai", 1, 5.0e9, ["stablecoins"]],
];

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7) + Math.floor(Date.now() / 3.6e6);

function walk(id: string, price: number, n: number, vol: number) {
  const r = rng(seedOf(id));
  const out = new Array<number>(n);
  out[n - 1] = price;
  for (let i = n - 1; i > 0; i--) out[i - 1] = out[i] / Math.exp((r() - 0.5) * vol);
  return out;
}

const img = (sym: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="32" fill="#150828" stroke="#05d9e8" stroke-width="3"/><text x="32" y="40" font-size="20" text-anchor="middle" fill="#05d9e8" font-family="sans-serif" font-weight="700">${sym.slice(0, 3).toUpperCase()}</text></svg>`)}`;

function market(row: (typeof COINS)[number], rank: number) {
  const [id, symbol, name, price, cap, tags] = row;
  const stable = tags.includes("stablecoins");
  const spark = walk(id, price, 168, stable ? 0.0005 : tags.includes("meme-token") ? 0.05 : 0.02);
  const ch = (k: number) => (stable ? 0 : (spark[spark.length - 1] / spark[Math.max(0, spark.length - 1 - k)] - 1) * 100);
  const supply = cap / price;
  return {
    id, symbol, name, image: img(symbol), current_price: price, market_cap: cap, market_cap_rank: rank,
    fully_diluted_valuation: cap * 1.1, total_volume: cap * 0.04, high_24h: price * 1.03, low_24h: price * 0.97,
    circulating_supply: supply, total_supply: supply * 1.05, max_supply: id === "bitcoin" ? 21e6 : null,
    ath: price * 1.6, ath_change_percentage: -37.5,
    price_change_percentage_1h_in_currency: ch(1), price_change_percentage_24h_in_currency: ch(24), price_change_percentage_7d_in_currency: ch(167),
    sparkline_in_7d: { price: spark },
    _tags: tags,
  };
}

export function demoCrypto(ep: string, p: URLSearchParams): unknown {
  const all = COINS.map((c, i) => market(c, i + 1));
  if (ep === "coins/markets") {
    const cat = p.get("category");
    const ids = p.get("ids")?.split(",");
    let list = all.filter((c) => (!cat || c._tags.includes(cat)) && (!ids || ids.includes(c.id)));
    const per = Number(p.get("per_page") ?? 100);
    const page = Number(p.get("page") ?? 1);
    list = list.slice((page - 1) * per, page * per);
    return list.map(({ _tags, ...c }) => (void _tags, c));
  }
  if (ep === "global")
    return {
      data: {
        active_cryptocurrencies: 17432, markets: 1312, total_market_cap: { usd: 3.31e12 }, total_volume: { usd: 1.18e11 },
        market_cap_percentage: { btc: 58.6, eth: 12.4 }, market_cap_change_percentage_24h_usd: -1.2,
      },
    };
  if (ep === "search/trending")
    return { coins: all.filter((c) => c._tags.includes("meme-token")).slice(0, 7).map((c) => ({ item: { id: c.id, name: c.name, symbol: c.symbol, thumb: c.image, market_cap_rank: c.market_cap_rank, data: { price: c.current_price, price_change_percentage_24h: { usd: c.price_change_percentage_24h_in_currency } } } })) };
  if (ep === "search") {
    const q = (p.get("query") ?? "").toLowerCase();
    return { coins: all.filter((c) => c.name.toLowerCase().includes(q) || c.symbol.includes(q)).map((c) => ({ id: c.id, name: c.name, symbol: c.symbol, thumb: c.image, market_cap_rank: c.market_cap_rank })) };
  }
  const m = /^coins\/([a-z0-9-]+)(\/ohlc)?$/.exec(ep);
  const c = m && all.find((x) => x.id === m[1]);
  if (!c) return null;
  if (m[2]) {
    const days = p.get("days") === "max" ? 1000 : Number(p.get("days") ?? 1);
    const step = days <= 2 ? 1800 : days <= 30 ? 14400 : 345600;
    const n = Math.min(400, Math.floor((days * 86400) / step));
    const closes = walk(c.id + days, c.current_price, n + 1, c._tags.includes("meme-token") ? 0.04 : 0.015);
    const now = Math.floor(Date.now() / 1000 / step) * step;
    return closes.slice(1).map((cl, i) => {
      const o = closes[i];
      return [(now - (n - 1 - i) * step) * 1000, o, Math.max(o, cl) * 1.004, Math.min(o, cl) * 0.996, cl];
    });
  }
  const usd = (v: number | null) => ({ usd: v ?? 0 });
  return {
    id: c.id, symbol: c.symbol, name: c.name, categories: c._tags.map((t) => t.replace(/-/g, " ")),
    description: { en: `[DEMO] ${c.name} is shown with placeholder data because the market data source is unreachable from this environment.` },
    links: { homepage: ["https://www.coingecko.com/"], blockchain_site: [], twitter_screen_name: c.symbol },
    image: { large: c.image, small: c.image }, genesis_date: null, platforms: {}, market_cap_rank: c.market_cap_rank,
    market_data: {
      current_price: usd(c.current_price), ath: usd(c.ath), ath_change_percentage: usd(c.ath_change_percentage), ath_date: { usd: "2025-01-20T00:00:00Z" },
      atl: usd(c.current_price * 0.05), atl_change_percentage: usd(1900), atl_date: { usd: "2023-01-01T00:00:00Z" },
      market_cap: usd(c.market_cap), fully_diluted_valuation: usd(c.fully_diluted_valuation), total_volume: usd(c.total_volume),
      high_24h: usd(c.high_24h), low_24h: usd(c.low_24h), price_change_percentage_1h_in_currency: usd(c.price_change_percentage_1h_in_currency),
      price_change_percentage_24h: c.price_change_percentage_24h_in_currency, price_change_percentage_7d: c.price_change_percentage_7d_in_currency,
      price_change_percentage_14d: 4.2, price_change_percentage_30d: -6.8, price_change_percentage_1y: 55.1,
      circulating_supply: c.circulating_supply, total_supply: c.total_supply, max_supply: c.max_supply,
    },
  };
}
