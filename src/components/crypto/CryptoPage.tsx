"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, cg, liveFor, useBinanceAll, useCryptoWatch, type CgCoin, type CgGlobal, type CgSearch, type CgTrending, type LiveTick } from "@/lib/crypto";
import { fmtBig, fmtNum } from "@/lib/format";
import { MarketNewsPanel } from "../FinPanels";
import { Change, LivePrice, Pill, SectionTitle, Sparkline } from "../ui";
import CoinDetail from "./CoinDetail";

const PER_PAGE = 100;
type SortKey = "rank" | "price" | "h1" | "h24" | "d7" | "vol" | "cap";

/* ───────────── header with navigation + coin search ───────────── */

function NavTabs() {
  const tab = "px-3 py-1.5 text-xs font-semibold tracking-wider uppercase transition";
  return (
    <div className="flex border border-brand/50">
      <Link href="/#overview" className={`${tab} text-brand hover:bg-brand/10`}>
        Обзор
      </Link>
      <Link href="/#day" className={`${tab} text-brand hover:bg-brand/10`}>
        ⚡ Дэйтрейдинг
      </Link>
      <span className={`${tab} bg-brand text-black shadow-[0_0_14px_rgba(5,217,232,0.6)]`}>◈ Крипто</span>
    </div>
  );
}

function CoinSearch({ onPick }: { onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<CgSearch["coins"]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) return;
    let alive = true;
    const t = setTimeout(() => {
      cg<CgSearch>("search", { query: q.trim() })
        .then((r) => alive && setRes(r.coins.slice(0, 12)))
        .catch(() => {});
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);
  const pick = (id: string) => {
    onPick(id);
    setQ("");
    setOpen(false);
  };
  return (
    <div className="relative w-full sm:w-80">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => e.key === "Enter" && res[0] && pick(res[0].id)}
        placeholder="⌕ Любая монета: PEPE, Solana, Fartcoin…"
        className="w-full border border-brand/50 bg-black/40 px-3 py-1.5 text-sm outline-none placeholder:text-faint focus:border-brand"
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute right-0 left-0 z-40 mt-1 max-h-96 overflow-y-auto border border-brand/50 bg-bg/95 backdrop-blur-xl">
          {res.length === 0 && <div className="px-3 py-2 text-xs text-muted">Поиск…</div>}
          {res.map((c) => (
            <button
              key={c.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(c.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand/10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.thumb} alt="" width={18} height={18} className="h-[18px] w-[18px] rounded-full" />
              <span className="font-semibold text-brand">{c.symbol.toUpperCase()}</span>
              <span className="truncate text-muted">{c.name}</span>
              <span className="ml-auto text-[11px] text-faint">{c.market_cap_rank ? `#${c.market_cap_rank}` : ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────── page ───────────── */

export default function CryptoPage() {
  const { ticks, connected } = useBinanceAll();
  const watch = useCryptoWatch();
  const [coinId, setCoinId] = useState<string | null>(null);
  const [cat, setCat] = useState("");
  const [page, setPage] = useState(1);
  const [coins, setCoins] = useState<CgCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [global, setGlobal] = useState<CgGlobal | null>(null);
  const [trending, setTrending] = useState<CgTrending["coins"]>([]);
  const [fng, setFng] = useState<{ value: number; label: string } | null>(null);
  const [sort, setSort] = useState<{ k: SortKey; desc: boolean }>({ k: "rank", desc: false });
  const [filter, setFilter] = useState("");
  const [updated, setUpdated] = useState<number | null>(null);
  const top = useRef<HTMLDivElement>(null);

  // #coin=<id> in the URL opens a coin page (shareable, back-button friendly)
  useEffect(() => {
    const read = () => {
      const m = /coin=([a-z0-9-]+)/.exec(location.hash);
      setCoinId(m ? m[1] : null);
    };
    const t = setTimeout(read, 0);
    window.addEventListener("hashchange", read);
    return () => {
      clearTimeout(t);
      window.removeEventListener("hashchange", read);
    };
  }, []);
  const openCoin = useCallback((id: string | null) => {
    location.hash = id ? `coin=${id}` : "";
    setCoinId(id);
    top.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // market list
  const watchKey = watch.ids.join(",");
  useEffect(() => {
    let alive = true;
    const load = async (first: boolean) => {
      if (first) setLoading(true);
      try {
        const params: Record<string, string | number | boolean> = {
          vs_currency: "usd",
          order: "market_cap_desc",
          per_page: PER_PAGE,
          page,
          sparkline: true,
          price_change_percentage: "1h,24h,7d",
        };
        if (cat === "watch") params.ids = watchKey || "bitcoin";
        else if (cat) params.category = cat;
        const list = await cg<CgCoin[]>("coins/markets", params);
        if (!alive) return;
        setCoins(list);
        setErr(null);
        setUpdated(Date.now());
      } catch (e) {
        if (alive) setErr((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    };
    const t = setTimeout(() => load(true), 0);
    const iv = setInterval(() => document.visibilityState === "visible" && load(false), 60_000);
    return () => {
      alive = false;
      clearTimeout(t);
      clearInterval(iv);
    };
  }, [cat, page, watchKey]);

  // global stats, trending, fear & greed
  useEffect(() => {
    let alive = true;
    const load = () => {
      cg<{ data: CgGlobal }>("global").then((g) => alive && setGlobal(g.data)).catch(() => {});
      cg<CgTrending>("search/trending").then((t) => alive && setTrending(t.coins.slice(0, 10))).catch(() => {});
      fetch("https://api.alternative.me/fng/?limit=1")
        .then((r) => r.json())
        .then((j: { data: { value: string; value_classification: string }[] }) =>
          alive && setFng({ value: Number(j.data[0].value), label: j.data[0].value_classification }),
        )
        .catch(() => {});
    };
    const t = setTimeout(load, 0);
    const iv = setInterval(load, 300_000);
    return () => {
      alive = false;
      clearTimeout(t);
      clearInterval(iv);
    };
  }, []);

  const rows = useMemo(() => {
    const withLive = coins.map((c) => {
      const t: LiveTick | null = liveFor(c, ticks);
      return {
        c,
        live: !!t,
        price: t?.c ?? c.current_price ?? 0,
        h1: c.price_change_percentage_1h_in_currency ?? NaN,
        h24: t ? (t.c / t.o - 1) * 100 : (c.price_change_percentage_24h_in_currency ?? NaN),
        d7: c.price_change_percentage_7d_in_currency ?? NaN,
      };
    });
    const f = filter.trim().toLowerCase();
    const list = f ? withLive.filter((r) => r.c.name.toLowerCase().includes(f) || r.c.symbol.toLowerCase().includes(f)) : withLive;
    const val = (r: (typeof list)[number]): number =>
      ({ rank: r.c.market_cap_rank ?? 1e9, price: r.price, h1: r.h1, h24: r.h24, d7: r.d7, vol: r.c.total_volume ?? 0, cap: r.c.market_cap ?? 0 })[sort.k];
    return [...list].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      const d = (isNaN(x) ? -1e18 : x) - (isNaN(y) ? -1e18 : y);
      return sort.desc ? -d : d;
    });
  }, [coins, ticks, filter, sort]);

  const movers = useMemo(() => {
    const valid = rows.filter((r) => isFinite(r.h24) && (r.c.total_volume ?? 0) > 1e5);
    const by = [...valid].sort((a, b) => b.h24 - a.h24);
    return { up: by.slice(0, 5), down: by.slice(-5).reverse() };
  }, [rows]);

  const liveCount = rows.filter((r) => r.live).length;
  const demo = coins.some((c) => c.image?.startsWith("data:"));
  const totalPages = cat === "" && global ? Math.ceil(global.active_cryptocurrencies / PER_PAGE) : coins.length < PER_PAGE ? page : page + 1;

  return (
    <div ref={top} className="min-h-screen overflow-x-clip">
      <header style={{ paddingTop: "env(safe-area-inset-top)" }} className="relative z-30 border-b border-brand/40 bg-bg/85 backdrop-blur-xl sm:sticky sm:top-0">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center border border-brand bg-brand/10 text-xl font-bold text-brand">◢</div>
            <div>
              <h1 data-text="NEON//PULSE" className="glitch text-xl leading-tight font-black">
                NEON//PULSE
              </h1>
              <p className="text-[11px] tracking-[0.2em] text-neon-pink uppercase">&gt; крипта онлайн</p>
            </div>
          </Link>
          <NavTabs />
          <div className="order-3 w-full sm:order-none sm:w-auto">
            <CoinSearch onPick={openCoin} />
          </div>
          <div className="flex items-center gap-2 text-xs">
            {demo && <Pill tone="warn">⚠ DEMO</Pill>}
            <span className={`flex items-center gap-1.5 ${connected ? "text-up" : "text-faint"}`}>
              <span className={`h-2 w-2 rounded-full ${connected ? "pulse-dot bg-up" : "bg-faint"}`} />
              {connected ? `BINANCE LIVE · ${Object.keys(ticks).length} пар` : "BINANCE —"}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6">
        {/* market-wide stats */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Strip label="Капитализация рынка" value={global ? fmtBig(global.total_market_cap.usd, "$") : "…"} sub={global ? <Change v={global.market_cap_change_percentage_24h_usd} /> : null} />
          <Strip label="Объём 24ч" value={global ? fmtBig(global.total_volume.usd, "$") : "…"} />
          <Strip label="Доминация BTC" value={global ? `${fmtNum(global.market_cap_percentage.btc, 1)}%` : "…"} />
          <Strip label="Доминация ETH" value={global ? `${fmtNum(global.market_cap_percentage.eth, 1)}%` : "…"} />
          <Strip label="Всего монет" value={global ? fmtNum(global.active_cryptocurrencies) : "…"} sub={global ? <span className="text-faint">{fmtNum(global.markets)} бирж</span> : null} />
          <Strip
            label="Страх и жадность"
            value={fng ? String(fng.value) : "…"}
            sub={fng ? <span className={fng.value >= 55 ? "text-up" : fng.value <= 45 ? "text-down" : "text-warn"}>{fng.label}</span> : null}
          />
        </div>

        {coinId ? (
          <CoinDetail id={coinId} ticks={ticks} onClose={() => openCoin(null)} starred={watch.has(coinId)} onStar={() => watch.toggle(coinId)} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <MiniList title="🔥 В тренде на CoinGecko" items={trending.map((t) => ({ id: t.item.id, sym: t.item.symbol, name: t.item.name, img: t.item.thumb, ch: t.item.data?.price_change_percentage_24h?.usd }))} onPick={openCoin} />
            <MiniList title="▲ Лидеры роста 24ч" items={movers.up.map((r) => ({ id: r.c.id, sym: r.c.symbol, name: r.c.name, img: r.c.image, ch: r.h24, price: r.price }))} onPick={openCoin} />
            <MiniList title="▼ Лидеры падения 24ч" items={movers.down.map((r) => ({ id: r.c.id, sym: r.c.symbol, name: r.c.name, img: r.c.image, ch: r.h24, price: r.price }))} onPick={openCoin} />
          </div>
        )}

        {/* coin table */}
        <section className="card p-5">
          <SectionTitle
            title="Криптовалюты"
            subtitle={`${liveCount} из ${rows.length} обновляются каждую секунду (Binance), остальные — раз в минуту (CoinGecko)${updated ? ` · ${new Date(updated).toLocaleTimeString("ru-RU")}` : ""}`}
            right={
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Фильтр на странице…"
                className="w-44 border border-brand/40 bg-black/30 px-2 py-1 text-xs outline-none placeholder:text-faint focus:border-brand"
              />
            }
          />
          <div className="mb-3 flex flex-wrap gap-1.5">
            {[...CATEGORIES, { id: "watch", label: `★ Избранное (${watch.ids.length})` }].map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setCat(c.id);
                  setPage(1);
                }}
                className={`border px-2.5 py-1 text-xs transition ${cat === c.id ? "border-brand bg-brand text-black" : "border-line text-muted hover:border-brand hover:text-brand"}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {err && <div className="mb-2 border border-down/40 bg-down/10 px-3 py-1.5 text-xs text-down">Ошибка загрузки: {err}</div>}
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="w-6" />
                  <SortTh sort={sort} setSort={setSort} k="rank">#</SortTh>
                  <th className="px-2 py-2 font-medium">Монета</th>
                  <SortTh sort={sort} setSort={setSort} k="price" cls="text-right">Цена</SortTh>
                  <SortTh sort={sort} setSort={setSort} k="h1" cls="text-right">1ч</SortTh>
                  <SortTh sort={sort} setSort={setSort} k="h24" cls="text-right">24ч</SortTh>
                  <SortTh sort={sort} setSort={setSort} k="d7" cls="text-right">7д</SortTh>
                  <SortTh sort={sort} setSort={setSort} k="vol" cls="text-right">Объём 24ч</SortTh>
                  <SortTh sort={sort} setSort={setSort} k="cap" cls="text-right">Капитализация</SortTh>
                  <th className="px-2 py-2 font-medium">7 дней</th>
                </tr>
              </thead>
              <tbody>
                {loading && !rows.length && (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-muted">
                      &gt; загрузка монет…
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.c.id} onClick={() => openCoin(r.c.id)} className="cursor-pointer border-b border-line/50 transition hover:bg-white/[0.03]">
                    <td className="px-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          watch.toggle(r.c.id);
                        }}
                        className={watch.has(r.c.id) ? "text-warn" : "text-faint hover:text-warn"}
                        aria-label="Избранное"
                      >
                        {watch.has(r.c.id) ? "★" : "☆"}
                      </button>
                    </td>
                    <td className="tnum px-2 text-faint">{r.c.market_cap_rank ?? "—"}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={r.c.image} alt="" width={22} height={22} loading="lazy" className="h-[22px] w-[22px] rounded-full" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-semibold text-ink">{r.c.name}</span>
                            {r.live && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-up" title="Binance live" />}
                          </div>
                          <div className="text-[11px] text-faint">{r.c.symbol.toUpperCase()}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 text-right font-medium">
                      <LivePrice value={r.price} />
                    </td>
                    <td className="px-2 text-right">{isFinite(r.h1) ? <Change v={r.h1} digits={1} /> : "—"}</td>
                    <td className="px-2 text-right">{isFinite(r.h24) ? <Change v={r.h24} digits={1} /> : "—"}</td>
                    <td className="px-2 text-right">{isFinite(r.d7) ? <Change v={r.d7} digits={1} /> : "—"}</td>
                    <td className="tnum px-2 text-right text-muted">{fmtBig(r.c.total_volume ?? 0, "$")}</td>
                    <td className="tnum px-2 text-right text-ink">{fmtBig(r.c.market_cap ?? 0, "$")}</td>
                    <td className="px-2">
                      <Sparkline data={r.c.sparkline_in_7d?.price ?? []} width={110} height={30} fill={false} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
            <PageBtn disabled={page <= 1} onClick={() => setPage(1)}>«</PageBtn>
            <PageBtn disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Назад</PageBtn>
            <span className="tnum px-2 text-muted">
              Стр. {page}
              {cat === "" && global ? ` из ${totalPages}` : ""}
            </span>
            <PageBtn disabled={coins.length < PER_PAGE} onClick={() => setPage(page + 1)}>Вперёд ›</PageBtn>
            {cat === "" && global && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = Number(new FormData(e.currentTarget).get("p"));
                  if (v >= 1) setPage(Math.min(v, totalPages));
                }}
                className="flex items-center gap-1"
              >
                <input name="p" type="number" min={1} max={totalPages} placeholder="стр." className="w-16 border border-line bg-black/30 px-1.5 py-1 text-xs outline-none focus:border-brand" />
                <button className="border border-brand/40 px-2 py-1 text-brand hover:bg-brand hover:text-black">Перейти</button>
              </form>
            )}
          </div>
        </section>

        <MarketNewsPanel />

        <footer className="pb-8 text-center text-[11px] text-faint">
          Данные: CoinGecko (список монет, капитализация, описания), Binance WebSocket (цены каждую секунду), alternative.me. Не является
          инвестиционной рекомендацией. Мем-коины крайне волатильны.
        </footer>
      </main>
    </div>
  );
}

function SortTh({
  k,
  children,
  cls = "",
  sort,
  setSort,
}: {
  k: SortKey;
  children: string;
  cls?: string;
  sort: { k: SortKey; desc: boolean };
  setSort: (f: (s: { k: SortKey; desc: boolean }) => { k: SortKey; desc: boolean }) => void;
}) {
  return (
    <th className={`px-2 py-2 font-medium ${cls}`}>
      <button
        onClick={() => setSort((s) => ({ k, desc: s.k === k ? !s.desc : k !== "rank" }))}
        className={`inline-flex items-center gap-1 hover:text-ink ${sort.k === k ? "text-ink" : ""}`}
      >
        {children}
        {sort.k === k && <span>{sort.desc ? "↓" : "↑"}</span>}
      </button>
    </th>
  );
}

function Strip({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-[11px] tracking-[0.12em] text-neon-pink uppercase">{label}</div>
      <div className="tnum mt-0.5 text-lg font-semibold text-brand">{value}</div>
      <div className="text-xs">{sub}</div>
    </div>
  );
}

function MiniList({
  title,
  items,
  onPick,
}: {
  title: string;
  items: { id: string; sym: string; name: string; img: string; ch?: number; price?: number }[];
  onPick: (id: string) => void;
}) {
  return (
    <div className="card p-4">
      <div className="mb-2 text-sm font-semibold text-ink">{title}</div>
      {items.length === 0 && <p className="py-3 text-center text-xs text-muted">Загрузка…</p>}
      <ul className="space-y-0.5">
        {items.slice(0, 7).map((i) => (
          <li key={i.id}>
            <button onClick={() => onPick(i.id)} className="flex w-full items-center gap-2 px-1 py-1 text-left text-xs hover:bg-white/[0.04]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.img} alt="" width={18} height={18} className="h-[18px] w-[18px] rounded-full" />
              <span className="font-semibold text-ink">{i.sym.toUpperCase()}</span>
              <span className="truncate text-faint">{i.name}</span>
              {i.price != null && <LivePrice value={i.price} className="ml-auto text-muted" />}
              {i.ch != null && isFinite(i.ch) ? <Change v={i.ch} digits={1} className={i.price != null ? "w-16 text-right" : "ml-auto"} /> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PageBtn({ children, disabled, onClick }: { children: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="border border-brand/40 px-2.5 py-1 text-brand transition hover:bg-brand hover:text-black disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-brand"
    >
      {children}
    </button>
  );
}
