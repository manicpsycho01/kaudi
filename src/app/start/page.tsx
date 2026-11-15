import type { Metadata } from "next";
import Link from "next/link";
import { Cowrie } from "@/components/Cowrie";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Start here", description: "Kaudi in five minutes, explained simply: eight harbour towns, one shared notebook, a puzzle race, and the rules that catch cheaters." };

const STEPS: { title: string; body: React.ReactNode; see: string }[] = [
  { title: "Your wallet is a secret stamp", body: <>Everyone has a stamp only they own. To send shells you stamp a note — “Asha gives Bilal 5 shells.” Anyone can check the stamp is really Asha&apos;s; nobody can copy it. That&apos;s a <b>signature</b>.</>, see: "Voyage 2 lets you make your own stamp and try to forge someone else's." },
  { title: "You tell the town", body: <>Asha&apos;s note goes to her harbour, and each harbour passes it on to the next by boat.</>, see: "On the map: the little amber dots sailing between ports." },
  { title: "A puzzle race decides who writes the next page", body: <>Every town keeps rolling dice — millions of times — until one gets a rare, lucky roll. The first to get it writes the next page and is rewarded with 50 new shells. That&apos;s <b>mining</b>, and it&apos;s the only way new shells appear.</>, see: "On the map: a coral ripple marks the winner; its page sails out as a little boat." },
  { title: "Every town checks the page", body: <>Before keeping a page, each town checks it: was the puzzle really solved? Are the stamps real? Is anyone spending shells they don&apos;t have? If anything is wrong, the town throws the page away — and says which rule it broke.</>, see: "The ship's log shows every refusal, with the reason." },
  { title: "Pages are glued in order", body: <>Every page carries a <b>fingerprint</b> of the page before it. Change an old page and its fingerprint changes, the glue stops matching, and everyone can tell. To hide it you&apos;d have to redo the puzzle for that page and every page after it — faster than all the towns together.</>, see: "Voyage 1 lets you change an old page and watch the chain break." },
];

const RULES: [string, string][] = [
  ["Solve the puzzle", "No new page without the hard dice-rolling work."],
  ["Real stamp only", "You can only spend shells you hold the secret stamp for."],
  ["Don't overspend", "You can't give away 10 shells if you only have 5."],
  ["No spending a shell twice", "Once a shell is given away, it's gone from you."],
  ["A capped reward", "The puzzle winner gets 50 shells plus tips — never more."],
  ["New shells wait", "Reward shells can only be spent 6 pages later."],
  ["Honest clocks", "A page can't claim to come from the future, or too far in the past."],
  ["Most work wins", "When towns disagree, everyone follows the notebook with the most puzzle work in it."],
  ["Change comes back", "Pay 5 from a 40-shell coin and you get 35 back. Whatever's left over is a tip for the winner."],
];

const MOMENTS: { emoji: string; title: string; body: string; href: string; cta: string }[] = [
  { emoji: "⛵", title: "The race", body: "Two far-apart towns solve the puzzle at the same moment, and for a little while the notebooks disagree — two different page tens. The next page settles it: everyone follows the longer story, and the other page is thrown away. Nothing broke; news just travelled slowly.", href: "/voyages/the-race", cta: "Watch a fork" },
  { emoji: "🌧", title: "The monsoon", body: "A storm stops the boats between west and east, so each side writes its own pages. When it clears, the side with less work throws its pages away and copies the other's. Payments in the thrown-away pages go back in the queue and get written again.", href: "/voyages/the-monsoon", cta: "Split the sea" },
  { emoji: "🏴‍☠️", title: "The Corsair", body: "A pirate gets more puzzle power than everyone else combined. He pays Dara 90 shells for pepper, Dara sees it written down and hands over the pepper — while the pirate secretly writes a longer notebook where he paid himself. He shows it, everyone switches, and Dara's payment vanishes. That's a 51% attack, and why shops wait for several pages before trusting a payment.", href: "/voyages/the-corsair", cta: "Be the pirate" },
  { emoji: "🕵", title: "The heist", body: "Six ways to cheat. Five get caught by towns checking the rules. Only the pirate's trick works.", href: "/heist", cta: "Try to rob it" },
  { emoji: "🔍", title: "Proof in a pocket", body: "To prove your payment is on a page you don't need the whole page — just a few fingerprints. That's how phone wallets check payments without downloading everything.", href: "/voyages/proof-in-a-pocket", cta: "Check a proof" },
];

export default function Start() {
  return (
    <>
      <SiteHeader current="/start" />
      <main id="main" className="mx-auto max-w-[1100px] px-4 py-12 sm:px-8 sm:py-16">
        <p className="label text-brass">Start here · five minutes</p>
        <h1 className="display mt-3 text-[clamp(2.6rem,6vw,4.6rem)]">Kaudi, simply</h1>
        <p className="mt-5 max-w-2xl text-[clamp(1.1rem,1.5vw,1.3rem)] leading-relaxed text-ink-2">
          No jargon to begin with. Just eight harbour towns, a notebook, and a puzzle.
        </p>

        <section className="mt-12 grid gap-8 border-t border-line pt-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]" aria-labelledby="story-h">
          <h2 id="story-h" className="display text-[1.9rem]">The story</h2>
          <div className="space-y-4 text-[18px] leading-relaxed text-ink-2">
            <p>Imagine eight harbour towns around a big ocean. People trade with shells called <i>kaudi</i> — cowries — but they don&apos;t carry real shells. They just write down in a notebook who has how many.</p>
            <p>The problem: <b className="font-medium text-ink">who keeps the notebook?</b> If one person keeps it, they could cheat and write “I have a million shells.”</p>
            <p>So in Kaudi, <b className="font-medium text-ink">every town keeps its own copy</b>. Nobody is the boss, and all eight copies have to agree. That shared notebook is the <b className="font-medium text-ink">blockchain</b>: each page is a <b className="font-medium text-ink">block</b>, and the pages are glued in order — a <b className="font-medium text-ink">chain</b>.</p>
          </div>
        </section>

        <section className="mt-14" aria-labelledby="steps-h">
          <h2 id="steps-h" className="display text-[1.9rem]">How a payment happens</h2>
          <ol className="mt-6 border-t border-line">
            {STEPS.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-4 border-b border-line py-6 sm:grid-cols-[4rem_minmax(0,1fr)_minmax(0,0.8fr)] sm:gap-8">
                <span className="display text-[2.2rem] leading-none text-brass">{i + 1}</span>
                <div>
                  <h3 className="display text-[1.35rem]">{s.title}</h3>
                  <p className="mt-2 text-[17px] leading-relaxed text-ink-2">{s.body}</p>
                </div>
                <p className="col-span-2 border-l-2 border-brass/50 pl-3 text-[15.5px] text-muted sm:col-span-1 sm:self-center">{s.see}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14" aria-labelledby="rules-h">
          <h2 id="rules-h" className="display text-[1.9rem]">The rules every town checks</h2>
          <p className="mt-2 max-w-2xl text-ink-2">Nine rules, in plain words. The <Link href="/rules" className="text-brass underline underline-offset-4">rules page</Link> has the exact versions.</p>
          <dl className="mt-6 grid gap-px border border-line bg-line sm:grid-cols-3">
            {RULES.map(([k, v]) => (
              <div key={k} className="bg-sea p-5"><dt className="flex items-center gap-2"><Cowrie className="h-5 w-auto text-brass" /><span className="display text-[1.15rem]">{k}</span></dt><dd className="mt-2 text-[16px] text-ink-2">{v}</dd></div>
            ))}
          </dl>
        </section>

        <section className="mt-14" aria-labelledby="moments-h">
          <h2 id="moments-h" className="display text-[1.9rem]">The exciting parts</h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {MOMENTS.map((m) => (
              <li key={m.title} className="flex flex-col border border-line bg-sea-2 p-5 md:last:odd:col-span-2">
                <h3 className="display flex items-center gap-3 text-[1.4rem]"><span aria-hidden className="text-[1.5rem]">{m.emoji}</span>{m.title}</h3>
                <p className="mt-2 text-[16.5px] leading-relaxed text-ink-2">{m.body}</p>
                <Link href={m.href} className="label mt-auto inline-flex min-h-11 items-center pt-3 text-brass underline-offset-4 hover:underline">{m.cta} →</Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14 grid gap-px border border-line bg-line sm:grid-cols-2" aria-label="What's real and what's pretend">
          <div className="bg-sea p-6"><h2 className="label text-kelp">Real</h2><p className="mt-2 text-[17px] text-ink-2">The puzzles (real maths), the secret stamps (the same kind Bitcoin uses), the notebook rules, and the checking.</p></div>
          <div className="bg-sea p-6"><h2 className="label text-amber">Pretend</h2><p className="mt-2 text-[17px] text-ink-2">The eight towns live inside your browser tab, the boats are a simulation, and the shells are worth nothing. Close the tab and they&apos;re gone.</p></div>
        </section>

        <section className="mt-14 border-l-2 border-coral pl-5 sm:pl-6" aria-label="In one sentence">
          <p className="display text-[clamp(1.4rem,2.6vw,2rem)] leading-snug">Eight towns keep the same notebook, race to solve puzzles to add pages, check every rule — and you get to watch them agree, disagree, and catch cheaters.</p>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/voyages/the-broken-cowrie" className="btn btn-signal">Begin the first voyage</Link>
          <Link href="/heist" className="btn">Try to rob it</Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
