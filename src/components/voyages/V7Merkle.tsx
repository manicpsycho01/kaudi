"use client";
import { useEffect, useMemo, useState } from "react";
import { concatBytes } from "@noble/hashes/utils.js";
import type { Block } from "@/chain/block";
import { hex, unhex } from "@/chain/bytes";
import { GENESIS, PEOPLE, personKey } from "@/chain/genesis";
import { sha256d } from "@/chain/hash";
import { merkleLevels, merkleProof, verifyProof } from "@/chain/merkle";
import { mineAsync } from "@/chain/miner";
import { COIN } from "@/chain/params";
import { finalize, makeCoinbase, makeSpend, type Tx } from "@/chain/tx";
import { kaudi } from "../format";

const who = (pkh: Uint8Array) => PEOPLE.find((p) => hex(personKey(p.id).pkh) === hex(pkh))?.name ?? "a miner";

export function V7Merkle() {
  const [block, setBlock] = useState<Block | null>(null);
  const [pick, setPick] = useState(3);
  const [lie, setLie] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const ring = PEOPLE.slice(0, 7);
      const pays: Tx[] = ring.map((p, i) => {
        const to = ring[(i + 1) % ring.length]!;
        return makeSpend(personKey(p.id), [{ txid: GENESIS.txs[0]!.id, vout: i }], [{ amount: BigInt(i + 2) * COIN, pkh: personKey(to.id).pkh }, { amount: (98n - BigInt(i)) * COIN - 100_000n, pkh: personKey(p.id).pkh }]);
      });
      const cb = makeCoinbase(1, [{ amount: 50n * COIN + 700_000n, pkh: new Uint8Array(20).fill(3) }], "Voyage 7");
      const { block } = await mineAsync({ version: 1, prevHash: GENESIS.hash, time: GENESIS.header.time + 8 }, [cb, ...pays]);
      if (live) setBlock(block);
    })();
    return () => { live = false; };
  }, []);

  const ids = useMemo(() => block?.txs.map((t) => t.id) ?? [], [block]);
  const levels = useMemo(() => (ids.length ? merkleLevels(ids).map((l) => l.map(hex)) : []), [ids]);
  const proof = useMemo(() => (ids.length ? merkleProof(ids, pick) : []), [ids, pick]);
  if (!block) return <p className="text-muted" role="status">Mining a block of eight transactions…</p>;

  const tx = block.txs[pick]!;
  // "Lie": claim the payment was bigger. Its txid changes, so the proof can't climb to the real root.
  const claimed = lie && !tx.coinbase ? finalize({ ...tx, outputs: [{ ...tx.outputs[0]!, amount: tx.outputs[0]!.amount * 10n }, ...tx.outputs.slice(1)] }) : tx;
  const steps: { a: string; b: string; out: string }[] = [];
  let cur = claimed.id;
  for (const s of proof) {
    const out = hex(sha256d(s.side === "left" ? concatBytes(unhex(s.hash), unhex(cur)) : concatBytes(unhex(cur), unhex(s.hash))));
    steps.push(s.side === "left" ? { a: s.hash, b: cur, out } : { a: cur, b: s.hash, out });
    cur = out;
  }
  const ok = verifyProof(claimed.id, proof, block.header.merkleRoot);
  // Which node in each level is on the path, and which is a sibling handed over in the proof.
  const path = levels.map((_, l) => pick >> l);
  const payer = (t: Tx) => PEOPLE.find((p) => hex(personKey(p.id).pubkey) === hex(t.inputs[0]!.pubkey))?.name ?? "someone";
  const describe = (t: Tx) => (t.coinbase ? "the coinbase paid the miner" : `${payer(t)} paid ${who(t.outputs[0]!.pkh)} ${kaudi(t.outputs[0]!.amount)} KAUDI`);

  return (
    <div className="space-y-10">
      <section aria-labelledby="m1">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div>
            <h2 id="m1" className="display text-[1.7rem]">1 · The tree inside every header</h2>
            <p className="mt-2 text-ink-2">The block header doesn&apos;t list its transactions. It holds one hash — the Merkle root — made by hashing transactions in pairs, then the pairs in pairs, up to a single fingerprint.</p>
          </div>
          <p className="self-end text-ink-2"><strong className="font-medium text-ink">Your move:</strong> pick a transaction. The proof is just the highlighted siblings — one per level.</p>
        </div>
        <div className="mt-6 overflow-x-auto border border-line bg-sea-2 p-3 sm:p-5" role="group" aria-label="Merkle tree">
          <div className="min-w-[640px] space-y-3">
            {[...levels].reverse().map((level, ri) => {
              const l = levels.length - 1 - ri;
              return (
                <div key={l} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${level.length}, minmax(0, 1fr))` }}>
                  {level.map((h, i) => {
                    const onPath = path[l] === i, sibling = l < levels.length - 1 && (path[l]! ^ 1) === i;
                    const isLeaf = l === 0;
                    const Tag = isLeaf ? "button" : "div";
                    return (
                      <Tag key={i} {...(isLeaf ? { type: "button" as const, onClick: () => setPick(i), "aria-pressed": pick === i, "aria-label": `Transaction ${i + 1}: ${describe(block.txs[i]!)}` } : {})}
                        className={`border px-2 py-2 text-left ${onPath ? "border-brass bg-sea-3" : sibling ? "border-amber bg-amber-soft" : "border-line"} ${isLeaf ? "min-h-11 hover:border-brass" : ""}`}>
                        <span className="label block text-[10.5px] text-muted">{l === levels.length - 1 ? "Merkle root (in header)" : isLeaf ? `tx ${i + 1}` : `level ${l}`}{sibling ? " · in proof" : ""}</span>
                        <span className={`hash block text-[11px] ${onPath ? "text-brass" : "text-ink-2"}`}>{h.slice(0, 10)}…</span>
                      </Tag>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" aria-labelledby="m2">
        <div>
          <h2 id="m2" className="display text-[1.7rem]">2 · Check it with three hashes</h2>
          <p className="mt-2 text-ink-2">A phone wallet keeps only block headers (80 bytes each). To learn that <em>{describe(tx)}</em> is in this block, it asks for {proof.length} hashes — {proof.length * 32} bytes — and recomputes the root itself. No need to trust whoever sent them: a wrong hash can&apos;t produce the right root.</p>
          <label className="mt-5 flex min-h-11 items-center gap-3"><input type="checkbox" className="h-5 w-5 accent-[var(--color-coral)]" checked={lie} onChange={(e) => setLie(e.target.checked)} disabled={!!tx.coinbase} />
            <span>Lie about it: claim the payment was ten times bigger</span></label>
        </div>
        <ol className="border border-line bg-sea-2 p-4 text-[14.5px]">
          <li className="pb-2"><span className="label text-muted">Start: txid of {lie ? "the claimed" : "the"} transaction</span><span className="hash block text-ink-2">{claimed.id}</span></li>
          {steps.map((s, i) => (
            <li key={i} className="border-t border-line-2 py-2"><span className="label text-muted">Step {i + 1}: sha256d(left ‖ right)</span>
              <span className="hash block text-muted">{s.a.slice(0, 16)}… ‖ {s.b.slice(0, 16)}…</span>
              <span className="hash block text-ink-2">= {s.out}</span></li>
          ))}
          <li className="border-t border-line pt-3"><span className="label text-muted">Root in the header</span><span className="hash block text-ink-2">{block.header.merkleRoot}</span>
            <p data-testid="merkle-verdict" className={`mt-2 text-[16px] ${ok ? "text-kelp" : "text-coral"}`}>{ok ? "✓ Match — the transaction is in the block." : "✗ No match — that transaction isn't in this block."}</p></li>
        </ol>
      </section>
    </div>
  );
}
