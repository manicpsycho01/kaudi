"use client";
import Link from "next/link";
import { useSim } from "@/lib/useSim";
import { VOYAGES } from "@/content/voyages";
import { Chart } from "./Chart";
import { Log } from "./Panels";

export function Landing() {
  const sim = useSim({ seed: "harbour", warmupBlocks: 4 });
  return (
    <>
      <section className="mx-auto grid max-w-[1400px] items-center gap-8 px-4 pt-6 pb-12 sm:pt-8 sm:px-8 lg:min-h-[calc(100svh-70px)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:pt-4 lg:pb-8" aria-labelledby="hero-h">
        <div className="flex min-w-0 flex-col">
          <p data-rise className="label text-brass">A coin and blockchain, built from scratch</p>
          <h1 id="hero-h" data-rise style={{ "--d": 1 } as React.CSSProperties} className="display mt-3 text-[clamp(3.6rem,11vw,9.5rem)] leading-[0.9] sm:mt-4 short:text-[clamp(4rem,8vw,7rem)]">Kaudi</h1>
          <p data-rise style={{ "--d": 2 } as React.CSSProperties} className="mt-4 text-[clamp(1.15rem,1.6vw,1.4rem)] leading-snug text-ink-2 italic">
            कौड़ी — the cowrie shell, the oldest money of the Indian Ocean.
          </p>
          <p data-rise style={{ "--d": 3 } as React.CSSProperties} className="display mt-4 text-[clamp(1.35rem,2.1vw,1.9rem)] leading-tight text-brass sm:mt-6">Watch it agree. Then try to rob it.</p>
          <p data-rise style={{ "--d": 3 } as React.CSSProperties} className="order-last mt-6 max-w-[34rem] text-[clamp(1.05rem,1.3vw,1.2rem)] leading-relaxed sm:order-none sm:mt-4">
            Real proof of work, real signatures, a real ledger — running as a live network of eight ports in your browser. Send coins, split the sea, watch forks resolve, and try every classic trick to steal from it.
          </p>
          <div data-rise style={{ "--d": 4 } as React.CSSProperties} className="mt-6 flex flex-wrap gap-3 sm:mt-8">
            <Link href="/heist" className="btn btn-signal">Try to rob it</Link>
            <Link href={`/voyages/${VOYAGES[0]!.slug}`} className="btn">Begin the voyages</Link>
            <Link href="/sea" className="btn">Open the sea</Link>
          </div>
          <p data-rise style={{ "--d": 5 } as React.CSSProperties} className="mt-4 text-[16px] text-ink-2">New to blockchains? <Link href="/start" className="text-brass underline underline-offset-4 hover:text-ink">Start here — the five-minute story</Link>.</p>
        </div>
        <div className="min-w-0" data-rise style={{ "--d": 2 } as React.CSSProperties}>
          <div className="neat bg-sea-2 p-1"><Chart snap={sim.snap} received={sim.received} /></div>
          <div className="mt-3 h-[4.6rem] overflow-hidden" aria-label="Latest from the network"><Log snap={sim.snap} kinds={["mined", "reorg", "net"]} limit={3} /></div>
        </div>
      </section>

      <section className="border-t border-line bg-sea-2" aria-labelledby="why-h">
        <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-16 sm:px-8 sm:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-16">
          <div>
            <p className="label text-brass">Why this exists</p>
            <h2 id="why-h" className="display mt-3 text-[clamp(2rem,4vw,3.2rem)]">I wanted to understand it, not just use it</h2>
          </div>
          <div className="max-w-2xl space-y-4 text-[clamp(1.05rem,1.3vw,1.2rem)] leading-relaxed text-ink-2">
            <p>I kept hearing <em>trustless</em>, <em>consensus</em>, <em>51% attack</em> — and realised I could repeat the words without being able to explain them. The usual first project is launching a token: fifteen lines on someone else&apos;s chain, and you learn almost nothing about how the chain works.</p>
            <p>So I built one from the bytes up — the hashing, the signatures, the ledger, eight nodes that disagree and then agree — and made it something you can <em>watch</em>, because the interesting parts of a blockchain are the moments when it almost breaks.</p>
            <p className="text-ink">Kaudi is the thing I wish I&apos;d had when I started. — Aravind</p>
          </div>
        </div>
      </section>

      <section className="border-t border-line" aria-labelledby="for-h">
        <div className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8 sm:py-24">
          <h2 id="for-h" className="display text-[clamp(2rem,4vw,3.2rem)]">Who it&apos;s for</h2>
          <ul className="mt-8 grid gap-px border border-line bg-line md:grid-cols-3">
            {[
              ["The curious", "You've been told a blockchain “can't be cheated”. In five minutes on the heist page, see why — and the one way it can.", "/heist", "Try to rob it"],
              ["People who explain things", "Every run can be shared as a link that replays it exactly: the same fork, the same reorg, the same robbery, for everyone who opens it.", "/sea", "Make a run to share"],
              ["Builders and interviewers", "Every rule is written down, tested, and named when it fires. Forge a block and read exactly which check caught it.", "/rules", "Read the rules"],
            ].map(([t, d, href, cta]) => (
              <li key={t} className="flex flex-col bg-sea p-6">
                <h3 className="display text-[1.45rem]">{t}</h3>
                <p className="mt-2 text-ink-2">{d}</p>
                <Link href={href!} className="label mt-auto inline-flex min-h-11 items-center pt-4 text-brass underline-offset-4 hover:underline">{cta} →</Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-line" aria-labelledby="voy-h">
        <div className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8 sm:py-24">
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div>
              <h2 id="voy-h" className="display text-[clamp(2rem,4vw,3.2rem)]">Seven voyages</h2>
              <p className="mt-3 max-w-sm text-ink-2">Each one is a few minutes long and runs the real thing — no recorded animations. Start at the first, or skip to whatever you came to understand.</p>
            </div>
            <ol className="border-t border-line">
              {VOYAGES.map((v) => (
                <li key={v.slug} className="border-b border-line">
                  <Link href={`/voyages/${v.slug}`} className="group grid grid-cols-[2.6rem_minmax(0,1fr)] gap-x-4 py-5 sm:grid-cols-[3.4rem_minmax(0,1fr)_minmax(0,1.3fr)] sm:gap-x-6">
                    <span className="display text-[2rem] text-brass">{String(v.n).padStart(2, "0")}</span>
                    <span>
                      <span className="display block text-[1.45rem] group-hover:text-brass">{v.title}</span>
                      <span className="label mt-1 block text-muted">{v.kicker}</span>
                    </span>
                    <span className="col-span-2 mt-2 text-[16px] text-ink-2 sm:col-span-1 sm:mt-0">{v.summary}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-sea-2" aria-labelledby="real-h">
        <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-16 sm:px-8 sm:py-24 md:grid-cols-2">
          <div>
            <h2 id="real-h" className="display text-[clamp(2rem,4vw,3.2rem)]">Real where it counts</h2>
            <p className="mt-3 max-w-md text-ink-2">The chain is not a picture of a chain. Every port runs the same validator, from bytes up, and refuses anything that breaks a rule — with the rule's name.</p>
            <div className="mt-6 flex flex-wrap gap-3"><Link className="btn" href="/rules">Read the rules</Link><Link className="btn" href="/real">What&apos;s simulated</Link></div>
          </div>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {[
              ["Proof of work", "Double SHA-256 over an 80-byte header, against a target in Bitcoin's compact form."],
              ["Signatures", "BIP340 Schnorr over secp256k1. Each signature covers the whole transaction."],
              ["Coins", "Unspent outputs, not balances. Coinbase rewards lock for six blocks."],
              ["Agreement", "Most cumulative work wins. Reorgs return orphaned payments to the queue."],
              ["Addresses", "hash160 of the public key in bech32m — kd1…, with a checksum that catches typos."],
              ["Merkle roots", "Bitcoin's tree, with duplicate transactions refused (CVE-2012-2459)."],
            ].map(([k, v]) => (
              <div key={k} className="border-t border-line pt-3"><dt className="label text-brass">{k}</dt><dd className="mt-1.5 text-[16px] text-ink-2">{v}</dd></div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
