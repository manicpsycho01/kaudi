import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { VOYAGES } from "@/content/voyages";

export const metadata: Metadata = { title: "Voyages", description: "Seven short, hands-on lessons that run a real blockchain: hashes, signatures, UTXOs, mining, partitions, a double spend and Merkle proofs." };

export default function Voyages() {
  return (
    <>
      <SiteHeader current="/voyages" />
      <main id="main" className="mx-auto max-w-[1100px] px-4 py-12 sm:px-8 sm:py-16">
        <p className="label text-brass">Seven voyages</p>
        <h1 className="display mt-3 text-[clamp(2.6rem,6vw,4.6rem)]">Learn it by running it</h1>
        <p className="mt-4 max-w-2xl text-[18px] text-ink-2">Each voyage is a few minutes long. The first three work on a single machine; from the fourth, the whole sea joins in.</p>
        <ol className="mt-10 grid gap-px border border-line bg-line sm:grid-cols-2">
          {VOYAGES.map((v) => (
            <li key={v.slug} className="bg-sea">
              <Link href={`/voyages/${v.slug}`} className="group flex h-full flex-col p-6 hover:bg-sea-2">
                <span className="flex items-baseline justify-between"><span className="display text-[2.4rem] text-brass">{String(v.n).padStart(2, "0")}</span><span className="label text-muted">{v.kicker}</span></span>
                <span className="display mt-2 text-[1.6rem] group-hover:text-brass">{v.title}</span>
                <span className="mt-2 text-ink-2">{v.summary}</span>
                <span className="label mt-auto pt-4 text-muted">{v.learn.join(" · ")}</span>
              </Link>
            </li>
          ))}
        </ol>
      </main>
      <SiteFooter />
    </>
  );
}
