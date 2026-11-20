import type { Fundamentals, NewsItem } from "./types";

/** Clearly-labelled placeholder data used only when no source is reachable (offline/dev). */
export function demoFundamentals(symbol: string, price: number, name?: string): Fundamentals {
  const r = (a: number, b: number, k = 1) => {
    const x = [...`${symbol}${k}`].reduce((s, c) => (s * 33 + c.charCodeAt(0)) % 9973, 7) / 9973;
    return a + (b - a) * x;
  };
  const pe = r(12, 45, 1);
  const eps = price / pe;
  const f = (v: number, d = 2) => v.toFixed(d);
  return {
    symbol,
    source: "demo",
    name: name ?? symbol,
    sector: "Technology",
    industry: "Demo Industry",
    country: "USA",
    exchange: "NASD",
    fields: {
      "Market Cap": `${f(r(20, 3000, 2), 2)}B`,
      "P/E": f(pe),
      "Forward P/E": f(pe * 0.85),
      PEG: f(r(0.8, 3, 3)),
      "P/S": f(r(2, 15, 4)),
      "P/B": f(r(2, 40, 5)),
      "P/FCF": f(r(15, 60, 6)),
      "EV/EBITDA": f(r(10, 35, 7)),
      "EPS (ttm)": f(eps),
      "EPS next Y": f(eps * 1.12),
      "EPS next Q": f(eps / 4),
      "EPS this Y": `${f(r(-5, 30, 8))}%`,
      "EPS next 5Y": `${f(r(5, 25, 9))}%`,
      "EPS Q/Q": `${f(r(-10, 40, 10))}%`,
      "Sales Q/Q": `${f(r(-5, 30, 11))}%`,
      Earnings: "Jan 29 AMC",
      ROA: `${f(r(3, 30, 12))}%`,
      ROE: `${f(r(8, 60, 13))}%`,
      ROIC: `${f(r(6, 45, 14))}%`,
      "Gross Margin": `${f(r(30, 75, 15))}%`,
      "Oper. Margin": `${f(r(10, 45, 16))}%`,
      "Profit Margin": `${f(r(5, 35, 17))}%`,
      "Debt/Eq": f(r(0.1, 2, 18)),
      "Current Ratio": f(r(0.8, 3, 19)),
      "Quick Ratio": f(r(0.6, 2.5, 20)),
      "Dividend TTM": `${f(r(0, 3, 21))} (${f(r(0, 2, 22))}%)`,
      Payout: `${f(r(0, 40, 23))}%`,
      "Insider Own": `${f(r(0.1, 10, 24))}%`,
      "Inst Own": `${f(r(50, 85, 25))}%`,
      "Short Float": `${f(r(0.5, 8, 26))}%`,
      "Short Ratio": f(r(0.5, 5, 27)),
      Beta: f(r(0.6, 2, 28)),
      "ATR (14)": f(price * 0.025),
      "Avg Volume": `${f(r(5, 80, 29))}M`,
      "Rel Volume": f(r(0.5, 2, 30)),
      "Target Price": f(price * r(0.95, 1.25, 31)),
      Recom: f(r(1.5, 3, 32)),
      Employees: String(Math.round(r(5000, 200000, 33))),
      "Perf Week": `${f(r(-5, 5, 34))}%`,
      "Perf YTD": `${f(r(-20, 50, 35))}%`,
    },
    news: demoNews(symbol),
    updatedAt: new Date().toISOString(),
  };
}

export function demoNews(symbol?: string): NewsItem[] {
  const now = Math.floor(Date.now() / 1000);
  const heads = symbol
    ? [`${symbol} shares move as investors weigh latest guidance`, `Analysts update price targets on ${symbol}`, `${symbol}: options activity jumps ahead of earnings`, `What Wall Street expects from ${symbol} this quarter`]
    : ["Stocks drift as traders await Fed minutes", "Bitcoin steadies after volatile week", "Gold holds near record as dollar softens", "Oil slips on supply outlook", "Tech leads Nasdaq higher in early trade", "Treasury yields edge lower"];
  return heads.map((title, i) => ({ id: `demo${i}`, title: `[DEMO] ${title}`, url: "https://finviz.com/news.ashx", source: "demo", time: now - i * 1700 - 120 }));
}
