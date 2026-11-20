"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtPct, fmtPrice } from "@/lib/format";
import { buildWidgetScript } from "@/lib/widgetScript";
import { NavTabs, SiteLogo } from "./SiteNav";
import { Pill, SectionTitle, Segmented } from "./ui";

interface WItem {
  symbol: string;
  label: string;
  price: number;
  chPct: number;
  spark: number[];
}
interface WData {
  items: WItem[];
  session: "open" | "pre" | "post" | "closed";
  source: string;
  updatedAt: string;
}

const PRESETS: { label: string; symbols: string[] }[] = [
  { label: "Рынки", symbols: ["^GSPC", "^NDX", "BTC-USD", "GC=F", "CL=F", "^VIX"] },
  { label: "Крипта", symbols: ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "DOGE-USD", "BNB-USD"] },
  { label: "Мега-капы", symbols: ["NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "AVGO"] },
];
const SIZES = { small: 1, medium: 4, large: 9 } as const;
type WSize = keyof typeof SIZES;
const STORE = "neon-pulse:widget-symbols";

const tone = (v: number) => (v > 0 ? "#00ff9f" : v < 0 ? "#ff2a6d" : "#7fd8e6");

function Spark({ data, w, h, color }: { data: number[]; w: number; h: number; color: string }) {
  if (data.length < 2) return <svg width={w} height={h} />;
  const min = Math.min(...data);
  const span = Math.max(...data) - min || 1;
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={`M0,${h} L${pts.join(" L")} L${w},${h} Z`} fill={color} opacity={0.14} />
      <path d={`M${pts.join(" L")}`} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}

const SESSION = { open: "NYSE · торги", pre: "NYSE · премаркет", post: "NYSE · постмаркет", closed: "NYSE · закрыта" };

/** HTML mock of the iOS widget so the user sees the result before installing. */
function Preview({ size, data }: { size: WSize; data: WData | null }) {
  const dims = { small: [170, 170], medium: [364, 170], large: [364, 382] }[size];
  const items = data?.items.slice(0, size === "small" ? 2 : SIZES[size]) ?? [];
  const time = data ? new Date(data.updatedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "--:--";
  return (
    <div
      className="flex flex-col overflow-hidden rounded-[22px] p-3.5 text-[#e8fbff] shadow-[0_10px_40px_rgba(0,0,0,0.6)]"
      style={{ width: dims[0], height: dims[1], background: "linear-gradient(180deg,#1a0833,#05010d)", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black tracking-wide text-[#05d9e8]">NEON//PULSE</span>
        <span className="tnum text-[10px] text-[#8a5fa8]">{time}</span>
      </div>
      {!items.length ? (
        <div className="grid flex-1 place-items-center text-xs text-[#8a5fa8]">Загрузка…</div>
      ) : size === "small" ? (
        <div className="mt-1.5 flex flex-1 flex-col">
          <span className="text-[15px] font-bold text-[#05d9e8]">{items[0].label}</span>
          <span className="tnum truncate text-[21px] font-bold">{fmtPrice(items[0].price)}</span>
          <span className="tnum mt-0.5 self-start rounded px-1 text-[11px] font-semibold" style={{ color: tone(items[0].chPct), background: `${tone(items[0].chPct)}29` }}>
            {fmtPct(items[0].chPct)}
          </span>
          <div className="mt-1">
            <Spark data={items[0].spark} w={140} h={32} color={tone(items[0].chPct)} />
          </div>
          {items[1] && (
            <div className="mt-auto flex justify-between text-[10px]">
              <span className="font-bold text-[#7fd8e6]">{items[1].label}</span>
              <span className="tnum" style={{ color: tone(items[1].chPct) }}>
                {fmtPct(items[1].chPct)}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-2 flex flex-1 flex-col gap-[7px]">
          {items.map((it) => (
            <div key={it.symbol} className="flex items-center gap-1.5 text-[13px]">
              <span className="w-[66px] truncate font-bold text-[#05d9e8]">{it.label}</span>
              <Spark data={it.spark} w={size === "large" ? 84 : 66} h={18} color={tone(it.chPct)} />
              <span className="tnum ml-auto truncate font-semibold">{fmtPrice(it.price)}</span>
              <span className="tnum w-[68px] shrink-0 rounded px-1 text-right text-[11px] font-semibold" style={{ color: tone(it.chPct), background: `${tone(it.chPct)}29` }}>
                {fmtPct(it.chPct)}
              </span>
            </div>
          ))}
          <div className="mt-auto flex justify-between text-[9px]">
            <span style={{ color: data?.session === "open" ? "#00ff9f" : "#8a5fa8" }}>{data ? SESSION[data.session] : ""}</span>
            <span className={data?.source === "demo" ? "text-[#f9f002]" : "text-[#8a5fa8]"}>{data?.source === "demo" ? "DEMO" : "онлайн"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WidgetBuilder() {
  const [symbols, setSymbols] = useState<string[]>(["^GSPC", "BTC-USD", "GC=F", "NVDA", "AAPL", "TSLA", "ETH-USD", "^NDX", "MSFT"]);
  const [input, setInput] = useState("");
  const [size, setSize] = useState<WSize>("large");
  const [base, setBase] = useState("");
  const [data, setData] = useState<WData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setBase(location.origin);
      try {
        const saved = localStorage.getItem(STORE);
        if (saved) setSymbols(JSON.parse(saved));
      } catch {
        /* ignore */
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const update = (next: string[]) => {
    const clean = [...new Set(next.map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z0-9^=.\-]{1,15}$/.test(s)))].slice(0, 12);
    setSymbols(clean);
    try {
      localStorage.setItem(STORE, JSON.stringify(clean));
    } catch {
      /* ignore */
    }
  };

  const key = symbols.join(",");
  useEffect(() => {
    if (!key) return;
    let alive = true;
    const load = () =>
      fetch(`/api/widget?symbols=${encodeURIComponent(key)}`)
        .then((r) => r.json())
        .then((d: WData) => alive && setData(d))
        .catch(() => {});
    const t = setTimeout(load, 0);
    const iv = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearTimeout(t);
      clearInterval(iv);
    };
  }, [key]);

  const script = useMemo(() => (base ? buildWidgetScript({ base, symbols }) : ""), [base, symbols]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(script);
    } catch {
      const ta = document.getElementById("widget-script") as HTMLTextAreaElement | null;
      ta?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([script], { type: "text/javascript" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "NeonPulse.js";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const addFromInput = () => {
    if (!input.trim()) return;
    update([...symbols, ...input.split(/[,\s]+/)]);
    setInput("");
  };

  return (
    <div className="min-h-screen overflow-x-clip">
      <header style={{ paddingTop: "env(safe-area-inset-top)" }} className="relative z-30 border-b border-brand/40 bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <SiteLogo subtitle="виджет для iphone" />
          <NavTabs active="widget" />
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] space-y-5 px-4 py-6 sm:px-6">
        <section className="card p-5">
          <SectionTitle title="Виджет котировок на экран iPhone" subtitle="Работает через бесплатное приложение Scriptable — без App Store-приложения от нас" />
          <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
            <div className="space-y-5">
              <div>
                <div className="mb-2 text-xs font-semibold text-muted">1. Тикеры в виджете (до 12, порядок = порядок строк)</div>
                <div className="flex flex-wrap gap-1.5">
                  {symbols.map((s, i) => (
                    <span key={s} className="flex items-center gap-1 border border-brand/50 bg-brand/10 px-2 py-0.5 text-xs text-brand">
                      {i > 0 && (
                        <button onClick={() => update([...symbols.slice(0, i - 1), s, symbols[i - 1], ...symbols.slice(i + 1)])} className="text-faint hover:text-brand" aria-label="Выше">
                          ‹
                        </button>
                      )}
                      {s}
                      <button onClick={() => update(symbols.filter((x) => x !== s))} className="text-faint hover:text-down" aria-label={`Убрать ${s}`}>
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addFromInput()}
                    placeholder="Добавить: PLTR, ETH-USD, ^VIX…"
                    className="w-56 border border-brand/40 bg-black/30 px-2 py-1 text-sm outline-none placeholder:text-faint focus:border-brand"
                  />
                  <button onClick={addFromInput} className="border border-brand px-3 py-1 text-xs text-brand hover:bg-brand hover:text-black">
                    + Добавить
                  </button>
                  {PRESETS.map((p) => (
                    <button key={p.label} onClick={() => update(p.symbols)} className="border border-line px-2 py-1 text-xs text-muted hover:border-brand hover:text-brand">
                      {p.label}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      try {
                        const wl = JSON.parse(localStorage.getItem("neon-pulse:watchlist") ?? "[]");
                        if (wl.length) update(wl);
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="border border-line px-2 py-1 text-xs text-muted hover:border-brand hover:text-brand"
                  >
                    ★ Мои акции
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-faint">Акции — тикер (NVDA), крипта — с «-USD» (BTC-USD), индексы — с «^» (^GSPC, ^NDX), золото GC=F, нефть CL=F.</p>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold text-muted">2. Скопируйте готовый скрипт</div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={copy} disabled={!script} className="border border-brand bg-brand px-4 py-2 text-sm font-semibold text-black shadow-[0_0_16px_rgba(5,217,232,0.5)] disabled:opacity-50">
                    {copied ? "✓ Скопировано" : "⧉ Скопировать скрипт"}
                  </button>
                  <button onClick={download} disabled={!script} className="border border-brand/50 px-4 py-2 text-sm text-brand hover:bg-brand/10 disabled:opacity-50">
                    ⇩ Скачать NeonPulse.js
                  </button>
                </div>
                <textarea
                  id="widget-script"
                  readOnly
                  value={script}
                  className="scroll-thin mt-2 h-40 w-full resize-y border border-line bg-black/40 p-2 font-mono text-[11px] text-muted outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <Segmented
                value={size}
                onChange={setSize}
                options={[
                  { value: "small", label: "Маленький" },
                  { value: "medium", label: "Средний" },
                  { value: "large", label: "Большой" },
                ]}
              />
              <div className="grid min-h-[400px] w-full place-items-center rounded-[28px] border border-line bg-[radial-gradient(circle_at_30%_20%,#2a0a45,#05010d_70%)] p-4">
                <Preview size={size} data={data} />
              </div>
              <span className="text-[11px] text-faint">Предпросмотр с живыми данными · обновляется каждые 30 с</span>
            </div>
          </div>
        </section>

        <section className="card p-5">
          <SectionTitle title="Как установить на iPhone" subtitle="Занимает около минуты" />
          <ol className="grid gap-3 text-sm md:grid-cols-2">
            {[
              <>
                Установите бесплатное приложение{" "}
                <a href="https://apps.apple.com/app/scriptable/id1405459188" target="_blank" rel="noreferrer" className="text-brand underline">
                  Scriptable
                </a>{" "}
                из App Store.
              </>,
              <>Откройте эту страницу на iPhone и нажмите <b className="text-brand">«Скопировать скрипт»</b>.</>,
              <>
                В Scriptable нажмите <b className="text-brand">＋</b> справа вверху, вставьте скрипт (долгое нажатие → «Вставить»), вверху назовите его{" "}
                <b className="text-brand">NeonPulse</b> и нажмите «Готово». Можно нажать ▶ — откроется предпросмотр.
              </>,
              <>
                На рабочем столе долго нажмите на пустое место → <b className="text-brand">«Изменить» / ＋</b> → найдите <b className="text-brand">Scriptable</b> →
                выберите размер (маленький, средний или большой) → «Добавить виджет».
              </>,
              <>
                Нажмите на добавленный виджет (или долгое нажатие → «Изменить виджет») и в поле <b className="text-brand">Script</b> выберите{" "}
                <b className="text-brand">NeonPulse</b>. Остальное можно не трогать — по нажатию на виджет откроется дэшборд.
              </>,
              <>
                Хотите другие тикеры в конкретном виджете — впишите их в поле <b className="text-brand">Parameter</b>, например{" "}
                <code className="text-warn">NVDA, TSLA, BTC-USD</code>. Так можно сделать несколько разных виджетов из одного скрипта.
              </>,
            ].map((step, i) => (
              <li key={i} className="flex gap-3 border border-line bg-white/[0.02] p-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center border border-neon-pink font-bold text-neon-pink">{i + 1}</span>
                <span className="text-ink/90">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 grid gap-3 text-xs text-muted md:grid-cols-3">
            <div className="border border-line p-3">
              <Pill tone="brand">Экран блокировки</Pill>
              <p className="mt-2">
                Тот же скрипт работает на экране блокировки (iOS 16+): долгое нажатие на экран блокировки → «Настроить» → виджеты → Scriptable. Строка, круг или
                прямоугольник с тремя тикерами.
              </p>
            </div>
            <div className="border border-line p-3">
              <Pill tone="warn">Частота обновления</Pill>
              <p className="mt-2">
                Скрипт просит обновление каждые 5 минут, но точное время решает iOS (обычно 5–15 минут). Без интернета виджет покажет последние данные со значком ⚠.
              </p>
            </div>
            <div className="border border-line p-3">
              <Pill>Обновления скрипта</Pill>
              <p className="mt-2">
                Скрипт берёт данные с <span className="text-brand">{base ? base.replace(/^https?:\/\//, "") : "вашего сайта"}</span>
                /api/widget. Если поменяете тикеры здесь — просто скопируйте скрипт заново и замените текст в Scriptable.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
