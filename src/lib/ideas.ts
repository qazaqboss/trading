import { correlation, logReturns } from "./indicators";
import { CORR_SYMBOLS } from "./assets";
import type { Asset, Direction, Idea, Regime } from "./types";

const NO_IDEAS = new Set(["^VIX", "^TNX"]);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const f = (n: number, d = 1) => n.toFixed(d);

function plan(a: Asset, dir: Direction, stopMult: number, rrMult: number, entry = a.m.price) {
  const risk = Math.max(a.m.atr * stopMult, entry * 0.004);
  const stop = dir === "SHORT" ? entry + risk : entry - risk;
  const target = dir === "SHORT" ? entry - risk * rrMult : entry + risk * rrMult;
  return { entry, stop, target, rr: rrMult };
}

/** Rule-based technical setups. Returns the strongest setup for the asset, if any. */
function evaluate(a: Asset): Idea | null {
  const m = a.m;
  const p = m.price;
  const above200 = p > m.sma200;
  const distSma50 = (p / m.sma50 - 1) * 100;
  const base = { id: a.symbol, symbol: a.symbol, ticker: a.ticker, name: a.name, cls: a.cls };
  const trendTxt = `Цена ${above200 ? "выше" : "ниже"} SMA200 (${f(((p / m.sma200) - 1) * 100)}%)`;

  // 1. Golden / death cross — fresh structural signals
  if (m.cross === "golden") {
    return {
      ...base, direction: "LONG", setup: "Золотой крест SMA50/200", horizon: "1–3 месяца",
      confidence: clamp(60 + m.score / 4, 40, 90),
      ...plan(a, "LONG", 2.5, 3),
      reasons: ["SMA50 пересекла SMA200 снизу вверх за последние 15 сессий", trendTxt, `RSI14 = ${f(m.rsi14, 0)}`],
    };
  }
  if (m.cross === "death") {
    return {
      ...base, direction: "SHORT", setup: "Крест смерти SMA50/200", horizon: "1–3 месяца",
      confidence: clamp(60 - m.score / 4, 40, 90),
      ...plan(a, "SHORT", 2.5, 3),
      reasons: ["SMA50 пересекла SMA200 сверху вниз за последние 15 сессий", trendTxt, `Изменение за 1М: ${f(m.ch1m)}%`],
    };
  }

  // 2. Breakout near 52-week high in an uptrend
  if (m.trend === "up" && m.fromHigh > -2.5 && m.rsi14 < 80) {
    return {
      ...base, direction: "LONG", setup: "Пробой 52-недельного максимума", horizon: "2–6 недель",
      confidence: clamp(55 + m.score / 3, 40, 92),
      ...plan(a, "LONG", 2, 2.5),
      reasons: [
        `До 52-нед. максимума ${f(Math.abs(m.fromHigh))}% — сила покупателей`,
        "Структура тренда: цена > SMA50 > SMA200",
        `Импульс: 1М ${f(m.ch1m)}%, 3М ${f(m.ch3m)}%`,
      ],
    };
  }

  // 3. Pullback to SMA50 inside a primary uptrend ("buy the dip")
  if (above200 && m.sma50 > m.sma200 && m.rsi14 < 45 && distSma50 < 3) {
    return {
      ...base, direction: "LONG", setup: "Откат в восходящем тренде", horizon: "2–8 недель",
      confidence: clamp(50 + m.score / 3 + (45 - m.rsi14), 40, 88),
      ...plan(a, "LONG", 2.2, 2.5),
      reasons: [
        `RSI14 = ${f(m.rsi14, 0)} — локальная перепроданность в аптренде`,
        `Цена у SMA50 (${distSma50 >= 0 ? "+" : ""}${f(distSma50)}%), SMA50 > SMA200`,
        trendTxt,
      ],
    };
  }

  // 4. Overbought — protect profits rather than chase
  if (m.rsi14 >= 75) {
    return {
      ...base, direction: "WATCH", setup: "Перекупленность — ждать отката", horizon: "1–3 недели",
      confidence: clamp(m.rsi14 - 15, 50, 85),
      ...plan(a, "LONG", 2, 2, Math.max(m.sma20, p - 2 * m.atr)),
      reasons: [
        `RSI14 = ${f(m.rsi14, 0)} — зона перекупленности`,
        `Цена выше SMA20 на ${f((p / m.sma20 - 1) * 100)}%`,
        "Вход — лимитом на откате к SMA20, а не по рынку",
      ],
    };
  }

  // 5. Capitulation — deeply oversold below the 200-day average
  if (!above200 && m.rsi14 <= 30) {
    return {
      ...base, direction: "WATCH", setup: "Перепроданность — возможен отскок", horizon: "1–2 недели",
      confidence: clamp(70 - m.rsi14, 40, 75),
      ...plan(a, "LONG", 1.8, 2),
      reasons: [
        `RSI14 = ${f(m.rsi14, 0)} — экстремальная перепроданность`,
        trendTxt + " — против основного тренда, только с подтверждением",
        `Просадка от максимума: ${f(m.fromHigh)}%`,
      ],
    };
  }

  // 6. Established downtrend
  if (m.trend === "down" && m.rsi14 < 55 && m.ch1m < 0) {
    return {
      ...base, direction: "SHORT", setup: "Нисходящий тренд", horizon: "2–6 недель",
      confidence: clamp(50 - m.score / 3, 40, 88),
      ...plan(a, "SHORT", 2, 2.5),
      reasons: ["Структура: цена < SMA50 < SMA200", `Импульс: 1М ${f(m.ch1m)}%, 3М ${f(m.ch3m)}%`, `RSI14 = ${f(m.rsi14, 0)}`],
    };
  }

  // 7. Healthy trend continuation
  if (m.trend === "up" && m.rsi14 >= 45 && m.rsi14 < 70 && m.ch1m > 0) {
    return {
      ...base, direction: "LONG", setup: "Продолжение тренда", horizon: "2–8 недель",
      confidence: clamp(45 + m.score / 3, 40, 85),
      ...plan(a, "LONG", 2.2, 2.5, Math.max(m.sma20, p - m.atr)),
      reasons: [
        "Цена > SMA50 > SMA200 — восходящая структура",
        `RSI14 = ${f(m.rsi14, 0)} — без перегрева`,
        "Вход — на откате к SMA20 / −1 ATR",
      ],
    };
  }
  return null;
}

export function buildIdeas(assets: Asset[]): Idea[] {
  return assets
    .filter((a) => !NO_IDEAS.has(a.symbol))
    .map(evaluate)
    .filter((x): x is Idea => !!x)
    .map((i) => ({ ...i, confidence: Math.round(i.confidence) }))
    .sort((a, b) => b.confidence - a.confidence);
}

export function buildRegime(assets: Asset[]): Regime {
  const by = (s: string) => assets.find((a) => a.symbol === s);
  const notes: string[] = [];
  let score = 0;

  const spx = by("^GSPC");
  if (spx) {
    const s = spx.m.trend === "up" ? 25 : spx.m.trend === "down" ? -25 : 0;
    score += s;
    notes.push(`S&P 500 ${spx.m.trend === "up" ? "в восходящем тренде" : spx.m.trend === "down" ? "в нисходящем тренде" : "без выраженного тренда"} (${spx.m.fromHigh.toFixed(1)}% от максимума)`);
  }
  const vix = by("^VIX");
  if (vix) {
    const v = vix.m.price;
    score += v < 15 ? 20 : v < 20 ? 8 : v < 25 ? -10 : v < 30 ? -20 : -30;
    notes.push(`VIX ${v.toFixed(1)} — ${v < 15 ? "спокойный рынок" : v < 20 ? "нормальная волатильность" : v < 30 ? "повышенный страх" : "паника"}`);
  }
  const dxy = by("DX-Y.NYB");
  if (dxy) {
    score += clamp(-dxy.m.ch1m * 5, -10, 10);
    notes.push(`Доллар (DXY) ${dxy.m.ch1m >= 0 ? "укрепился" : "ослаб"} на ${Math.abs(dxy.m.ch1m).toFixed(1)}% за месяц`);
  }
  const btc = by("BTC-USD");
  if (btc) {
    score += btc.m.trend === "up" ? 12 : btc.m.trend === "down" ? -12 : 0;
    notes.push(`Биткоин: ${btc.m.trend === "up" ? "аптренд" : btc.m.trend === "down" ? "даунтренд" : "боковик"}, RSI ${btc.m.rsi14.toFixed(0)}`);
  }
  const gold = by("GC=F");
  if (gold && spx && gold.m.ch1m > 3 && spx.m.ch1m < 0) {
    score -= 10;
    notes.push("Золото растёт при падении акций — спрос на защитные активы");
  } else if (gold) {
    notes.push(`Золото: ${gold.m.ch1m >= 0 ? "+" : ""}${gold.m.ch1m.toFixed(1)}% за месяц`);
  }
  const stocks = assets.filter((a) => a.cls === "stock");
  if (stocks.length) {
    const breadth = (stocks.filter((s) => s.m.price > s.m.sma50).length / stocks.length) * 100;
    score += (breadth - 50) * 0.4;
    notes.push(`Ширина рынка: ${breadth.toFixed(0)}% акций выше SMA50`);
  }
  score = Math.round(clamp(score, -100, 100));
  const label =
    score > 40 ? "Risk-On" : score > 10 ? "Умеренно позитивный" : score >= -10 ? "Нейтральный" : score >= -40 ? "Осторожный" : "Risk-Off";
  return { score, label, notes };
}

export function buildCorrelation(assets: Asset[], window = 90) {
  const list = CORR_SYMBOLS.map((s) => assets.find((a) => a.symbol === s)).filter((a): a is Asset => !!a);
  // align on dates every asset traded (crypto trades on weekends, stocks don't)
  const sets = list.map((a) => new Set(a.history.map((b) => b.t)));
  const common = [...sets[0] ?? []].filter((d) => sets.every((s) => s.has(d))).sort().slice(-(window + 1));
  const rets = list.map((a) => {
    const map = new Map(a.history.map((b) => [b.t, b.c]));
    return logReturns(common.map((d) => map.get(d)!));
  });
  const matrix = rets.map((x) => rets.map((y) => Math.round(correlation(x, y) * 100) / 100));
  return { labels: list.map((a) => a.ticker), matrix };
}
