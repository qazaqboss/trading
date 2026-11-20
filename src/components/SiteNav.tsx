import Link from "next/link";

type Active = "overview" | "day" | "crypto" | "widget";

/** Top navigation shared by the standalone pages (/crypto, /widget). */
export function NavTabs({ active }: { active: Active }) {
  const tab = "px-3 py-1.5 text-xs font-semibold tracking-wider uppercase transition whitespace-nowrap";
  const items: [Active, string, string][] = [
    ["overview", "/#overview", "Обзор"],
    ["day", "/#day", "⚡ Дэйтрейдинг"],
    ["crypto", "/crypto", "◈ Крипто"],
    ["widget", "/widget", "▣ Виджет"],
  ];
  return (
    <nav className="scroll-thin flex max-w-full overflow-x-auto border border-brand/50">
      {items.map(([k, href, label]) =>
        k === active ? (
          <span key={k} className={`${tab} bg-brand text-black shadow-[0_0_14px_rgba(5,217,232,0.6)]`}>
            {label}
          </span>
        ) : (
          <Link key={k} href={href} className={`${tab} text-brand hover:bg-brand/10`}>
            {label}
          </Link>
        ),
      )}
    </nav>
  );
}

export function SiteLogo({ subtitle }: { subtitle: string }) {
  return (
    <Link href="/" className="flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center border border-brand bg-brand/10 text-xl font-bold text-brand">◢</div>
      <div>
        <h1 data-text="NEON//PULSE" className="glitch text-xl leading-tight font-black">
          NEON//PULSE
        </h1>
        <p className="text-[11px] tracking-[0.2em] text-neon-pink uppercase">&gt; {subtitle}</p>
      </div>
    </Link>
  );
}
