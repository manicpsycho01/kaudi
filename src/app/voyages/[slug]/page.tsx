import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { VoyageShell } from "@/components/VoyageShell";
import { V1Hash } from "@/components/voyages/V1Hash";
import { V2Keys } from "@/components/voyages/V2Keys";
import { V3Utxo } from "@/components/voyages/V3Utxo";
import { V4Race } from "@/components/voyages/V4Race";
import { V5Monsoon } from "@/components/voyages/V5Monsoon";
import { V6Corsair } from "@/components/voyages/V6Corsair";
import { V7Merkle } from "@/components/voyages/V7Merkle";
import { voyage, VOYAGES } from "@/content/voyages";

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return VOYAGES.map((v) => ({ slug: v.slug })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const v = voyage((await params).slug);
  return v ? { title: `${v.title} — Voyage ${v.n}`, description: v.summary } : {};
}

const CONTENT: Record<string, { brief: React.ReactNode; body: React.ReactNode; after: React.ReactNode }> = {
  "the-broken-cowrie": {
    brief: <><p>A blockchain is a list of blocks where each one carries the fingerprint of the one before. Change anything old and the fingerprints stop matching.</p><p>That alone wouldn&apos;t stop a forger — fingerprints are quick to recompute. What stops them is <em>proof of work</em>: every block&apos;s fingerprint must also be a rare, low number that takes real effort to find.</p></>,
    body: <V1Hash />,
    after: <><h2>What you just saw</h2><p>Bitcoin works the same way, with a target so low the whole world&apos;s machines need about ten minutes per block. Kaudi&apos;s target is set for one block every eight seconds on a simulated network, but the hashing is real — the tries you watched were real SHA-256 computations in your browser.</p></>,
  },
  "keys-and-seals": {
    brief: <><p>There are no accounts and no passwords. A coin is locked to an address; whoever can produce a valid signature for that address can spend it.</p><p>Kaudi uses the same signature scheme as Bitcoin&apos;s Taproot upgrade: Schnorr signatures (BIP340) on the secp256k1 curve.</p></>,
    body: <V2Keys />,
    after: <><h2>What you just saw</h2><p>Lose the secret key and the coins are gone for good — nobody can reset it. Leak it and anyone can spend them. That&apos;s the trade blockchains make: no one can take your coins, and no one can help you get them back.</p></>,
  },
  "counting-shells": {
    brief: <><p>Bitcoin-style chains keep no balances. They keep a set of unspent outputs — coins of odd sizes — and every payment spends whole coins and creates new ones.</p><p>Spend a 40 to pay 30, and you get a 10 back as change. Whatever you don&apos;t assign anywhere is the fee.</p></>,
    body: <V3Utxo />,
    after: <><h2>What you just saw</h2><p>Because a coin is either spent or not, every port can check a payment against its own copy of the unspent set — no bank, no running balance to trust. And because outputs are spent whole, forgetting the change output really does hand it to the miner.</p></>,
  },
  "the-race": {
    brief: <><p>Mining is a lottery where every hash is a ticket. Ports with more hash power win more often, but nobody can predict the next winner.</p><p>The catch is distance. A block found at Malacca takes time to reach Zanzibar, and Zanzibar keeps mining on the old tip until it arrives.</p></>,
    body: <V4Race />,
    after: <><h2>What you just saw</h2><p>Forks like this happen naturally whenever news travels slower than blocks are found. Bitcoin keeps them rare with ten-minute blocks; faster chains see more. Either way, the rule that settles them is the same: follow the chain with the most work.</p></>,
  },
  "the-monsoon": {
    brief: <><p>What if the network splits for longer — a cut cable, a firewall, a monsoon? Each side carries on, mining its own chain and confirming its own payments.</p><p>When they reconnect, only one history can survive.</p></>,
    body: <V5Monsoon />,
    after: <><h2>What you just saw</h2><p>The losing side&apos;s blocks didn&apos;t fail any rule — they were simply outworked. Payments in them weren&apos;t lost; they went back into the queue and were confirmed again. A payment only disappears if the winning chain spent the same coin differently. That&apos;s the next voyage.</p></>,
  },
  "the-corsair": {
    brief: <><p>A double spend: pay someone, get the goods, then make the payment never have happened.</p><p>You can&apos;t forge a signature or skip the work. But if you have more hash power than everyone else combined, you can quietly build a longer history in which the coin went somewhere else — and publish it after the goods are gone.</p></>,
    body: <V6Corsair />,
    after: <><h2>What you just saw</h2><p>Nothing was broken: every block followed every rule. The defence isn&apos;t cryptography, it&apos;s economics — owning most of the hash power is ruinously expensive, and each confirmation a merchant waits for makes a smaller attacker&apos;s odds collapse.</p></>,
  },
  "proof-in-a-pocket": {
    brief: <><p>Checking a whole chain takes a lot of storage. Phones and browser wallets instead keep only block headers and ask for proof when they need it.</p><p>The Merkle root in every header makes that proof tiny.</p></>,
    body: <V7Merkle />,
    after: <><h2>What you just saw</h2><p>This is the “simplified payment verification” from §8 of the Bitcoin whitepaper. The same trick sits under Ethereum&apos;s state proofs and Certificate Transparency logs. A proof grows by one hash each time a block doubles in size: a block of a million transactions needs twenty.</p></>,
  },
};

export default async function VoyagePage({ params }: Props) {
  const { slug } = await params;
  const v = voyage(slug), c = CONTENT[slug];
  if (!v || !c) notFound();
  return (
    <>
      <SiteHeader current="/voyages" />
      <main id="main"><VoyageShell v={v} brief={c.brief} after={c.after}>{c.body}</VoyageShell></main>
      <SiteFooter />
    </>
  );
}
