import Link from "next/link";
import { Cowrie } from "./Cowrie";

const NAV = [
  { href: "/start", label: "Start here", wide: true },
  { href: "/voyages", label: "Voyages" },
  { href: "/heist", label: "Heist" },
  { href: "/sea", label: "The sea" },
  { href: "/rules", label: "Rules", wide: true },
  { href: "/real", label: "What's real", wide: true },
] as { href: string; label: string; wide?: boolean }[];

export function SiteHeader({ current }: { current?: string }) {
  return (
    <header className="relative z-20 border-b border-line">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3 sm:px-8">
        <Link href="/" className="flex min-h-11 items-center gap-2.5 text-ink hover:text-brass" aria-label="Kaudi home">
          <Cowrie className="h-7 w-auto text-brass" />
          <span className="display text-[22px] tracking-[0.14em]">Kaudi</span>
        </Link>
        <nav aria-label="Main" className="-mx-2 flex flex-wrap">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={current === n.href ? "page" : undefined}
              className={`label min-h-11 items-center px-2 sm:px-3 hover:text-brass ${n.wide ? "hidden sm:flex" : "flex"} ${current === n.href ? "text-brass" : "text-ink-2"}`}>{n.label}</Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-8 text-[15px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>Kaudi is a teaching chain. Its coins exist only in your browser tab and are worth exactly a phooti kaudi.</p>
        <p className="label flex gap-5">
          <a className="flex min-h-11 items-center hover:text-brass" href="https://github.com/manicpsycho01/kaudi">Source</a>
          <Link className="flex min-h-11 items-center hover:text-brass" href="/rules">Rules</Link>
          <Link className="flex min-h-11 items-center hover:text-brass" href="/real">What&apos;s real</Link>
        </p>
      </div>
    </footer>
  );
}
