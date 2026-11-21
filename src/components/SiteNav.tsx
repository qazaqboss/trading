import Link from "next/link";

type Active = "overview" | "day" | "crypto" | "widget";

/** Top navigation shared by the standalone pages (/crypto, /widget). */
export function NavTabs({ active }: { active: Active }) {
  const tab =
    "px-1 py-1.5 text-center text-[11px] font-semibold uppercase transition whitespace-nowrap sm:px-3 sm:text-xs sm:tracking-wider";
  const items: [Active, string, string, string][] = [
    ["overview", "/#overview", "Обзор", "Обзор"],
    ["day", "/#day", "⚡ Дэй", "⚡ Дэйтрейдинг"],
    ["crypto", "/crypto", "◈ Крипто", "◈ Крипто"],
    ["widget", "/widget", "▣ Виджет", "▣ Виджет"],
  ];
  const label = (short: string, long: string) => (
    <>
      <span className="sm:hidden">{short}</span>
      <span className="hidden sm:inline">{long}</span>
    </>
  );
  return (
    <nav className="grid w-full grid-cols-4 border border-brand/50 sm:flex sm:w-auto">
      {items.map(([k, href, short, long]) =>
        k === active ? (
          <span key={k} className={`${tab} bg-brand text-black shadow-[0_0_14px_rgba(5,217,232,0.6)]`}>
            {label(short, long)}
          </span>
        ) : (
          <Link key={k} href={href} className={`${tab} text-brand hover:bg-brand/10`}>
            {label(short, long)}
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
