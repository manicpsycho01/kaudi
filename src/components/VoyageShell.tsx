import Link from "next/link";
import { VOYAGES, type Voyage } from "@/content/voyages";

/** The frame every voyage shares: title, a short brief, the interactive part, then where to go next. */
export function VoyageShell({ v, brief, children, after }: { v: Voyage; brief: React.ReactNode; children: React.ReactNode; after?: React.ReactNode }) {
  const prev = VOYAGES[v.n - 2], next = VOYAGES[v.n];
  return (
    <article className="mx-auto max-w-[1400px] px-4 pb-16 sm:px-8">
      <header className="grid gap-6 border-b border-line pt-8 pb-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-12">
        <div>
          <p className="label text-brass">Voyage {v.n} of {VOYAGES.length} · {v.kicker}</p>
          <h1 className="display mt-3 text-[clamp(2.4rem,5.5vw,4.4rem)]">{v.title}</h1>
        </div>
        <div className="max-w-2xl self-end text-[17.5px] leading-relaxed text-ink-2 [&_p+p]:mt-3">{brief}</div>
      </header>
      <div className="pt-8">{children}</div>
      {after && <section className="mt-12 max-w-3xl border-t border-line pt-8 text-[17.5px] leading-relaxed text-ink-2 [&_h2]:display [&_h2]:mb-3 [&_h2]:text-[1.6rem] [&_h2]:text-ink [&_p+p]:mt-3">{after}</section>}
      <nav aria-label="Voyages" className="mt-14 grid gap-px border border-line bg-line sm:grid-cols-2">
        {prev ? <Link href={`/voyages/${prev.slug}`} className="bg-sea p-5 hover:bg-sea-2"><span className="label text-muted">← Voyage {prev.n}</span><span className="display mt-1 block text-[1.3rem]">{prev.title}</span></Link> : <Link href="/voyages" className="bg-sea p-5 hover:bg-sea-2"><span className="label text-muted">← All voyages</span><span className="display mt-1 block text-[1.3rem]">The charts</span></Link>}
        {next ? <Link href={`/voyages/${next.slug}`} className="bg-sea p-5 text-right hover:bg-sea-2"><span className="label text-muted">Voyage {next.n} →</span><span className="display mt-1 block text-[1.3rem]">{next.title}</span></Link> : <Link href="/sea" className="bg-sea p-5 text-right hover:bg-sea-2"><span className="label text-muted">Free play →</span><span className="display mt-1 block text-[1.3rem]">The open sea</span></Link>}
      </nav>
    </article>
  );
}

/** A step in a voyage: number, instruction, done state. */
export function Step({ n, done, active, title, children }: { n: number; done: boolean; active?: boolean; title: string; children?: React.ReactNode }) {
  return (
    <li className={`grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border-t border-line py-4 ${active || done ? "" : "opacity-55"}`} aria-current={active ? "step" : undefined}>
      <span className={`mono mt-0.5 grid h-7 w-7 place-items-center border text-[12px] ${done ? "border-kelp bg-kelp-soft text-kelp" : active ? "border-brass text-brass" : "border-line text-muted"}`} aria-hidden>{done ? "✓" : n}</span>
      <div className="min-w-0">
        <p className={`text-[17px] ${done ? "text-ink-2" : "text-ink"}`}>{title}<span className="sr-only">{done ? " (done)" : ""}</span></p>
        {children && <div className="mt-2 text-[15.5px] text-ink-2">{children}</div>}
      </div>
    </li>
  );
}
