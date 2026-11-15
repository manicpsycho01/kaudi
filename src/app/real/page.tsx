import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "What's real", description: "What in Kaudi is a real blockchain mechanism, what is simulated, what was left out — and what it is not." };

const REAL = [
  ["Hashing and proof of work", "Every block's header is hashed with double SHA-256 until it falls below the target. The tries you see counted are real computations in your browser."],
  ["Signatures", "Every payment is signed with BIP340 Schnorr on secp256k1 and checked by every port. Forgeries fail verification; they aren't marked as failing."],
  ["The ledger", "Coins are unspent outputs. Spends, change, fees, coinbase maturity and the supply cap are enforced by the validator, in integers."],
  ["Each port is a full node", "Eight separate copies of the chain, each validating every block and transaction itself, keeping its own block tree, best tip and pending pool."],
  ["Forks and reorgs", "Ports follow the chain with most cumulative work, switch when a better one arrives, and return orphaned payments to the queue."],
];
const SIMULATED = [
  ["The network", "All eight ports run in one background thread in your tab. Messages are delivered after a delay based on sea distance, with a little random jitter. There is no internet traffic."],
  ["Hash power", "Each port is given a hash rate — a number of real hashes per simulated second — rather than earning it with hardware. That's how you can hand the Corsair 60% with a slider."],
  ["Time", "A simulated clock you can pause, speed up and step. It runs on a fixed grid, so a shared link replays a run exactly."],
  ["Keys", "Demo wallets' keys come from public seeds, so anyone can recreate them. Fine for a teaching chain — never for money."],
];
const LEFT_OUT = [
  ["Difficulty adjustment", "The target is fixed. Change the hash power and blocks get faster or slower; Bitcoin would retarget every 2,016 blocks."],
  ["Scripts", "Outputs can only be paid to a public-key hash. No multisig, time locks or smart contracts."],
  ["A fee market", "Miners take pending payments in arrival order; there's no replace-by-fee and no bidding for space."],
  ["Real peer-to-peer", "No peer discovery, no bans, no encrypted transport, no denial-of-service protection."],
  ["Storage", "Nothing persists. Reload the page and the sea starts over (unless you shared the run)."],
];

export default function Real() {
  return (
    <>
      <SiteHeader current="/real" />
      <main id="main" className="mx-auto max-w-[1100px] px-4 py-12 sm:px-8 sm:py-16">
        <p className="label text-brass">Honest chart</p>
        <h1 className="display mt-3 text-[clamp(2.6rem,6vw,4.6rem)]">What&apos;s real, and what isn&apos;t</h1>
        <p className="mt-4 max-w-2xl text-[18px] text-ink-2">Kaudi is a teaching chain that runs in a browser tab. The rules and the cryptography are the real thing; the network and the miners are a simulation of the real thing. Here&apos;s exactly where that line is.</p>
        <Group title="Real" tone="text-kelp" items={REAL} />
        <Group title="Simulated" tone="text-amber" items={SIMULATED} />
        <Group title="Left out, on purpose" tone="text-muted" items={LEFT_OUT} />
        <section className="mt-14 border border-coral/50 bg-coral-soft p-5 sm:p-6">
          <h2 className="display text-[1.6rem] text-coral">What Kaudi is not</h2>
          <p className="mt-2 max-w-3xl text-ink-2">It isn&apos;t a cryptocurrency you can buy, sell or hold. There is no token sale, no mainnet and no wallet to connect. Its coins exist only in your tab and vanish when you close it. If anyone offers you KAUDI for money, it isn&apos;t this.</p>
        </section>
        <p className="mt-10 text-ink-2">The full rule set is on <Link className="text-brass underline underline-offset-4" href="/rules">the rules page</Link>, and the code — including the test suite — is <a className="text-brass underline underline-offset-4" href="https://github.com/manicpsycho01/kaudi">on GitHub</a>.</p>
      </main>
      <SiteFooter />
    </>
  );
}

function Group({ title, tone, items }: { title: string; tone: string; items: string[][] }) {
  return (
    <section className="mt-12" aria-label={title}>
      <h2 className={`label ${tone}`}>{title}</h2>
      <dl className="mt-3 border-t border-line">
        {items.map(([k, v]) => (
          <div key={k} className="grid gap-1 border-b border-line py-4 sm:grid-cols-[16rem_minmax(0,1fr)] sm:gap-6">
            <dt className="display text-[1.15rem]">{k}</dt><dd className="text-ink-2">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
