import type { Metadata } from "next";
import Link from "next/link";
import { CoinLive } from "@/components/CoinLive";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { COIN } from "@/content/coin";

export const metadata: Metadata = { title: "KDI, the real coin", description: "Kaudi as a real ERC-20 coin on the Base Sepolia test network: a fair launch, Bitcoin's halving curve, a 21 million cap and no owner." };

const FACTS = [
  ["Fair launch", "No pre-mine and no team allocation: the contract started with zero coins. Every KDI in existence was claimed from the faucet — including the first 100, which the deployer claimed the same way anyone can."],
  ["Bitcoin's curve", "Each era issues half of what's left: 10.5 million KDI at 100 a claim, then 5.25 million at 50, then 25… The supply approaches 21 million and never reaches past it."],
  ["No owner", "There's no admin, no pause, no mint button and no upgrade path. Once deployed, the rules can't be changed by anyone — including me."],
  ["Burnable, permit-ready", "Holders can burn their KDI (the cap still never refills), and sign approvals off-chain with ERC-2612 permits."],
];
const COMPARE = [
  ["What it is", "A whole blockchain: its own ledger, miners, network and native coin", "A token: a contract on someone else's blockchain"],
  ["Who secures it", "Kaudi's eight simulated ports, by proof of work", "Base, an Ethereum layer 2, and ultimately Ethereum"],
  ["Where it runs", "In your browser tab; gone when you close it", "On a public test network; anyone can look it up"],
  ["What you learn", "How a chain agrees, forks and breaks", "How almost every real 'new coin' is actually launched"],
];

export default function Coin() {
  return (
    <>
      <SiteHeader current="/coin" />
      <main id="main" className="mx-auto max-w-[1100px] px-4 py-12 sm:px-8 sm:py-16">
        <p className="label text-brass">The real coin</p>
        <h1 className="display mt-3 text-[clamp(2.6rem,6vw,4.6rem)]">KDI: Kaudi, on a real chain</h1>
        <p className="mt-4 max-w-2xl text-[18px] text-ink-2">Everywhere else on this site, Kaudi is a blockchain built from scratch that lives in your tab. KDI is the other way coins are made: a token contract on an existing blockchain — here Base&apos;s public test network — that anyone can claim, send and look up.</p>
        <div className="mt-10">
          {COIN.address ? <CoinLive /> : (
            <section className="border border-amber/50 bg-amber-soft p-5 sm:p-6"><h2 className="display text-[1.6rem]">Launching soon</h2><p className="mt-2 max-w-2xl text-ink-2">The contract is written and tested; it goes on chain as soon as the deployer has a little test ETH for gas. This page will show it live.</p></section>
          )}
        </div>
        <section className="mt-16" aria-label="The rules">
          <h2 className="label text-brass">The rules, written into the contract</h2>
          <dl className="mt-3 border-t border-line">{FACTS.map(([k, v]) => <div key={k} className="grid gap-1 border-b border-line py-4 sm:grid-cols-[16rem_minmax(0,1fr)] sm:gap-6"><dt className="display text-[1.15rem]">{k}</dt><dd className="text-ink-2">{v}</dd></div>)}</dl>
        </section>
        <section className="mt-16" aria-labelledby="cmp-h">
          <h2 id="cmp-h" className="label text-brass">Two ways to make a coin</h2>
          <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Kaudi chain compared with the KDI token">
            <table className="w-full min-w-[640px] text-left">
              <thead><tr className="border-b border-line"><th className="label py-3 pr-4 text-muted" scope="col"></th><th className="label py-3 pr-4 text-ink" scope="col">Kaudi, the chain</th><th className="label py-3 text-ink" scope="col">KDI, the token</th></tr></thead>
              <tbody>{COMPARE.map(([k, a, b]) => <tr key={k} className="border-b border-line align-top"><th scope="row" className="display py-3 pr-4 text-[1.05rem] font-normal">{k}</th><td className="py-3 pr-4 text-ink-2">{a}</td><td className="py-3 text-ink-2">{b}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
        <section className="mt-14 border border-coral/50 bg-coral-soft p-5 sm:p-6">
          <h2 className="display text-[1.6rem] text-coral">Worth nothing, on purpose</h2>
          <p className="mt-2 max-w-3xl text-ink-2">KDI lives only on a test network, where coins are free and have no value. There is no sale, no mainnet version and there never will be. If anyone offers you KDI or KAUDI for money, it isn&apos;t this.</p>
        </section>
        <p className="mt-10 text-ink-2">
          {COIN.address && <>Contract: <a className="font-mono break-all text-brass underline underline-offset-4" href={`${COIN.explorer}/address/${COIN.address}`}>{COIN.address}</a>. </>}
          Read <a className="text-brass underline underline-offset-4" href={COIN.source}>the contract&apos;s source</a>, or see <Link className="text-brass underline underline-offset-4" href="/real">what&apos;s real</Link> in the rest of Kaudi.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
