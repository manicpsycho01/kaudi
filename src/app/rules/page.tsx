import type { Metadata } from "next";
import { GENESIS } from "@/chain/genesis";
import { TARGET, TARGET_BITS } from "@/chain/block";
import { BLOCK_INTERVAL_S, BLOCK_REWARD, COIN, COINBASE_MATURITY, EXPECTED_ATTEMPTS, HALVING_INTERVAL, MAX_BLOCK_TXS, MAX_FUTURE_S, MTP_WINDOW } from "@/chain/params";
import { RULES } from "@/chain/validate";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Rules", description: "Kaudi's consensus rules and byte formats — the exact checks every port runs on every block and transaction." };

const PARAMS: [string, string, string][] = [
  ["Block reward", `${BLOCK_REWARD / COIN} KAUDI`, "Bitcoin started at 50 BTC too"],
  ["Halving", `every ${HALVING_INTERVAL} blocks`, "Bitcoin: every 210,000"],
  ["Smallest unit", "1 kani = 0.00000001 KAUDI", "Like a satoshi"],
  ["Target block interval", `${BLOCK_INTERVAL_S} simulated seconds`, "Bitcoin: 600 seconds"],
  ["Proof-of-work target", `bits 0x${TARGET_BITS.toString(16)} ≈ 1 in ${EXPECTED_ATTEMPTS.toLocaleString("en-US")} hashes`, "Fixed — no retargeting (see What's real)"],
  ["Coinbase maturity", `${COINBASE_MATURITY} blocks`, "Bitcoin: 100"],
  ["Timestamp window", `after the median of the last ${MTP_WINDOW}, at most ${MAX_FUTURE_S} s ahead`, "Bitcoin: median of 11, 2 hours ahead"],
  ["Block size", `at most ${MAX_BLOCK_TXS} transactions`, "Bitcoin limits weight instead"],
  ["Fork choice", "most cumulative work; ties keep the first seen", "Same as Bitcoin"],
];

export default function Rules() {
  return (
    <>
      <SiteHeader current="/rules" />
      <main id="main" className="mx-auto max-w-[1100px] px-4 py-12 sm:px-8 sm:py-16">
        <p className="label text-brass">Specification</p>
        <h1 className="display mt-3 text-[clamp(2.6rem,6vw,4.6rem)]">The rules of the sea</h1>
        <p className="mt-4 max-w-2xl text-[18px] text-ink-2">Every port runs exactly these checks, from the same code, and refuses anything that fails one — naming the rule. This page is generated from that code, so it can&apos;t drift from it.</p>

        <section className="mt-12" aria-labelledby="p-h">
          <h2 id="p-h" className="display text-[1.8rem]">Parameters</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-[15.5px]">
              <thead><tr className="label text-left text-muted"><th className="py-2 pr-4 font-normal">Parameter</th><th className="py-2 pr-4 font-normal">Kaudi</th><th className="py-2 font-normal">Compared with Bitcoin</th></tr></thead>
              <tbody>{PARAMS.map(([a, b, c]) => <tr key={a} className="border-t border-line"><td className="py-2.5 pr-4">{a}</td><td className="mono py-2.5 pr-4 text-[14px] text-ink">{b}</td><td className="py-2.5 text-ink-2">{c}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="mt-14" aria-labelledby="f-h">
          <h2 id="f-h" className="display text-[1.8rem]">Byte formats</h2>
          <p className="mt-2 max-w-2xl text-ink-2">All integers little-endian. Hashes are double SHA-256 and are compared as big-endian numbers — unlike Bitcoin, nothing is byte-reversed for display.</p>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <Format title="Block header — 80 bytes" rows={[["4", "version"], ["32", "previous block hash"], ["32", "Merkle root"], ["4", "time (seconds)"], ["4", "bits (compact target)"], ["4", "nonce"]]} />
            <Format title="Transaction" rows={[["4", "version"], ["var", "input count"], ["32+4", "each input: txid, output index"], ["32+64", "…its x-only public key, Schnorr signature"], ["var", "output count"], ["8+20", "each output: amount, hash160(pubkey)"]]} />
            <Format title="Coinbase input" rows={[["32", "all zeros"], ["4", "0xffffffff"], ["var", "data: height (4), extranonce (4), message"]]} />
          </div>
          <dl className="mt-6 grid gap-x-8 gap-y-4 text-[16px] text-ink-2 md:grid-cols-2">
            <div><dt className="label text-brass">txid</dt><dd className="mt-1">sha256d of the full serialisation, signatures included.</dd></div>
            <div><dt className="label text-brass">Signature message</dt><dd className="mt-1">sha256d of the transaction with every signature set to 64 zero bytes, followed by the input&apos;s index (4 bytes). Signatures never sign themselves; changing any field breaks all of them.</dd></div>
            <div><dt className="label text-brass">Address</dt><dd className="mt-1">bech32m, prefix <span className="mono">kd</span>, of RIPEMD-160(SHA-256(x-only public key)).</dd></div>
            <div><dt className="label text-brass">Target</dt><dd className="hash mt-1">{TARGET.toString(16).padStart(64, "0")}</dd></div>
          </dl>
        </section>

        <section className="mt-14" aria-labelledby="r-h">
          <h2 id="r-h" className="display text-[1.8rem]">Validation rules</h2>
          <p className="mt-2 max-w-2xl text-ink-2">The code each port reports when it refuses something, and the rule behind it.</p>
          <ul className="mt-5 border-t border-line">
            {Object.entries(RULES).map(([code, rule]) => (
              <li key={code} className="grid gap-1 border-b border-line py-3 sm:grid-cols-[15rem_minmax(0,1fr)] sm:gap-6">
                <code className="mono text-[13.5px] text-brass">{code}</code><span className="text-ink-2">{rule}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14" aria-labelledby="g-h">
          <h2 id="g-h" className="display text-[1.8rem]">Genesis</h2>
          <p className="mt-2 max-w-2xl text-ink-2">Hard-coded, like Bitcoin&apos;s. Its coinbase gives each of the eight demo wallets 100 KAUDI and is spendable immediately — an allocation, not a mining reward — and carries the message:</p>
          <blockquote className="mt-4 border-l-2 border-brass pl-4 text-[19px] italic">“{GENESIS.txs[0]!.coinbase!.message}”</blockquote>
          <p className="hash mt-4 text-muted">hash {GENESIS.hash} · nonce {GENESIS.header.nonce}</p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function Format({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="border border-line bg-sea-2 p-4">
      <h3 className="label text-brass">{title}</h3>
      <table className="mt-3 w-full text-[14.5px]"><tbody>{rows.map(([b, f]) => <tr key={f} className="border-t border-line-2"><td className="mono w-[4.5rem] py-1.5 pr-2 align-top text-[12.5px] text-muted">{b}</td><td className="py-1.5 text-ink-2">{f}</td></tr>)}</tbody></table>
    </div>
  );
}
