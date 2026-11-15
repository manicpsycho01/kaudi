"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { headerHash, meetsTarget, TARGET, TARGET_BITS, type Header } from "@/chain/block";
import { hex, utf8 } from "@/chain/bytes";
import { GENESIS, personKey } from "@/chain/genesis";
import { sha256 } from "@/chain/hash";
import { verify } from "@/chain/keys";
import { merkleRoot } from "@/chain/merkle";
import { mineAsync } from "@/chain/miner";
import { COIN } from "@/chain/params";
import { finalize, makeCoinbase, makeSpend, sighash, type Tx } from "@/chain/tx";
import { kaudi } from "../format";

function Playground() {
  const [text, setText] = useState("Asha pays Bilal 5 KAUDI");
  const h = useMemo(() => hex(sha256(utf8(text))), [text]);
  const prev = useRef(h);
  const [before, setBefore] = useState(h);
  useEffect(() => { setBefore(prev.current); prev.current = h; }, [h]);
  const changed = [...h].filter((c, i) => c !== before[i]).length;
  return (
    <section aria-labelledby="pg-h" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div>
        <h2 id="pg-h" className="display text-[1.7rem]">1 · A fingerprint for anything</h2>
        <p className="mt-2 text-ink-2">SHA-256 turns any text into 64 hex characters. Same input, same output, every time. Change anything — one letter, one space — and the output changes beyond recognition.</p>
      </div>
      <div className="border border-line bg-sea-2 p-4">
        <label className="label text-muted" htmlFor="pg-in">Type anything</label>
        <input id="pg-in" className="field mt-2" value={text} onChange={(e) => setText(e.target.value)} />
        <p className="label mt-4 text-muted">SHA-256</p>
        <p className="hash mt-1 text-[14px]" data-testid="sha">
          {[...h].map((c, i) => <span key={i} className={c !== before[i] ? "text-coral" : "text-ink-2"}>{c}</span>)}
        </p>
        <p className="label mt-3 text-muted" aria-live="polite">{text ? `${changed} of 64 characters changed by your last keystroke` : "Even nothing has a fingerprint"}</p>
      </div>
    </section>
  );
}

type Mini = { header: Header; txs: Tx[]; label: string; amountIdx: number };
const PAYS: [string, string, bigint][] = [["asha", "bilal", 5n], ["bilal", "chen", 2n], ["chen", "dara", 1n]];
const NAMES: Record<string, string> = { asha: "Asha", bilal: "Bilal", chen: "Chen", dara: "Dara" };

export function V1Hash() {
  const [blocks, setBlocks] = useState<Mini[] | null>(null);
  const [mining, setMining] = useState<{ i: number; tries: number; hash: string } | null>(null);
  const [remined, setRemined] = useState(0);

  // Build a real 3-block chain on top of genesis (mined in this tab, at the real target).
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      const out: Mini[] = [];
      let prev = GENESIS.hash, time = GENESIS.header.time;
      const coin: Record<string, { txid: string; vout: number }> = {};
      PAYS.forEach(([p], i) => { if (!coin[p]) coin[p] = { txid: GENESIS.txs[0]!.id, vout: ["asha", "bilal", "chen", "dara"].indexOf(p) }; void i; });
      for (const [i, [from, to, amt]] of PAYS.entries()) {
        const k = personKey(from);
        const tx = makeSpend(k, [coin[from]!], [{ amount: amt * COIN, pkh: personKey(to).pkh }, { amount: (100n - amt) * COIN - 100_000n, pkh: k.pkh }]);
        const cb = makeCoinbase(i + 1, [{ amount: 50n * COIN + 100_000n, pkh: new Uint8Array(20).fill(1) }], "Voyage 1");
        time += 8;
        const { block } = await mineAsync({ version: 1, prevHash: prev, time }, [cb, tx], undefined, ac.signal);
        out.push({ header: block.header, txs: block.txs, label: `${NAMES[from]} pays ${NAMES[to]}`, amountIdx: 0 });
        prev = block.hash;
      }
      setBlocks(out);
    })().catch(() => {});
    return () => ac.abort();
  }, []);

  const view = useMemo(() => {
    if (!blocks) return [];
    return blocks.map((b, i) => {
      const header = { ...b.header, merkleRoot: merkleRoot(b.txs.map((t) => t.id)) };
      return { ...b, header, hash: headerHash(header) };
    }).map((b, i, all) => {
      const pay = b.txs[1]!;
      const linkOk = i === 0 ? b.header.prevHash === GENESIS.hash : b.header.prevHash === all[i - 1]!.hash;
      return { ...b, pow: meetsTarget(b.hash, TARGET_BITS), linkOk, sigOk: verify(pay.inputs[0]!.sig, sighash(pay, 0), pay.inputs[0]!.pubkey) };
    });
  }, [blocks]);

  const edit = (i: number, v: string) => setBlocks((bs) => bs && bs.map((b, j) => {
    if (j !== i) return b;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return b;
    const pay = b.txs[1]!;
    // Change the amount but keep the old signature: exactly what a forger editing history would do.
    const tampered = finalize({ ...pay, outputs: [{ ...pay.outputs[0]!, amount: BigInt(Math.round(n * 1e8)) }, ...pay.outputs.slice(1)] });
    return { ...b, txs: [b.txs[0]!, tampered] };
  }));

  const remine = async (i: number) => {
    if (!blocks) return;
    const prevHash = i === 0 ? GENESIS.hash : view[i - 1]!.hash;
    setMining({ i, tries: 0, hash: "" });
    const { block, tries } = await mineAsync({ version: 1, prevHash, time: blocks[i]!.header.time }, blocks[i]!.txs, (tries, hash) => setMining({ i, tries, hash }));
    setRemined((r) => r + tries);
    setBlocks((bs) => bs && bs.map((b, j) => (j === i ? { ...b, header: block.header } : b)));
    setMining(null);
  };
  const broken = view.findIndex((b) => !b.pow || !b.linkOk);

  return (
    <div className="space-y-14">
      <Playground />
      <section aria-labelledby="ch-h">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div>
            <h2 id="ch-h" className="display text-[1.7rem]">2 · A chain of fingerprints</h2>
            <p className="mt-2 text-ink-2">Each block stores the fingerprint of the block before it, and must itself have a fingerprint below a target — a number only found by trying nonces, about 32,000 tries per block here.</p>
          </div>
          <p className="self-end text-ink-2"><strong className="font-medium text-ink">Your move:</strong> change the amount Asha paid Bilal in block #1. Then try to repair the chain.</p>
        </div>
        {!blocks && <p className="mt-6 text-muted" role="status">Mining three blocks in your browser…</p>}
        {blocks && (
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {view.map((b, i) => {
              const ok = b.pow && b.linkOk;
              const z = b.hash.match(/^0*/)![0].length;
              return (
                <li key={i} data-testid={`mini-${i + 1}`} data-ok={ok} className={`border p-4 ${ok ? "border-line bg-sea-2" : "border-coral bg-coral-soft"}`}>
                  <div className="flex items-baseline justify-between"><span className="display text-[1.5rem]">Block #{i + 1}</span><span className={`label ${ok ? "text-kelp" : "text-coral"}`}>{ok ? "valid" : "broken"}</span></div>
                  <p className="label mt-3 text-muted">Previous block</p>
                  <p className={`hash ${b.linkOk ? "text-ink-2" : "text-coral line-through"}`}>{b.header.prevHash.slice(0, 22)}…</p>
                  <label className="mt-3 block"><span className="label text-muted">{b.label} (KAUDI)</span>
                    <input className="field mt-1" inputMode="decimal" defaultValue={kaudi(b.txs[1]!.outputs[0]!.amount)} onChange={(e) => edit(i, e.target.value)} aria-label={`${b.label}, amount in KAUDI`} disabled={!!mining} />
                  </label>
                  <p className="label mt-3 text-muted">Nonce</p><p className="mono text-[14px]">{b.header.nonce.toLocaleString("en-US")}</p>
                  <p className="label mt-3 text-muted">This block&apos;s hash</p>
                  <p className="hash"><span className={b.pow ? "text-kelp" : "text-coral"}>{b.hash.slice(0, z)}</span><span className="text-ink-2">{b.hash.slice(z, 30)}…</span></p>
                  <ul className="mt-3 space-y-1 text-[14.5px]">
                    <li className={b.pow ? "text-kelp" : "text-coral"}>{b.pow ? "✓" : "✗"} hash is below the target</li>
                    <li className={b.linkOk ? "text-kelp" : "text-coral"}>{b.linkOk ? "✓" : "✗"} points at the real previous block</li>
                    <li className={b.sigOk ? "text-kelp" : "text-amber"}>{b.sigOk ? "✓" : "✗"} payer&apos;s signature matches</li>
                  </ul>
                  {!ok && (
                    <button type="button" className="btn mt-4 w-full" disabled={!!mining} onClick={() => void remine(i)}>
                      {mining?.i === i ? `Mining… ${mining.tries.toLocaleString("en-US")} tries` : "Re-mine this block"}
                    </button>
                  )}
                  {mining?.i === i && <p className="hash mt-2 text-muted" aria-hidden>{mining.hash.slice(0, 24)}…</p>}
                </li>
              );
            })}
          </ol>
        )}
        <div className="mt-6 max-w-3xl text-ink-2" aria-live="polite">
          {broken === -1 && remined > 0 && (
            <p>You repaired every block — {remined.toLocaleString("en-US")} hashes of work. But look at the signature line: Asha signed a payment of 5, not what you typed, so every honest port would still refuse block #1. To rewrite history you need the work <em>and</em> the keys — and you&apos;d have to out-mine the entire sea, which kept adding blocks the whole time you were busy.</p>
          )}
          {broken >= 0 && <p>Block #{broken + 1} is broken{broken < view.length - 1 ? ", and the damage flows forward: every later block points at a fingerprint that no longer exists" : ""}. Re-mine it, then see what happens to the next one.</p>}
          {broken === -1 && remined === 0 && blocks && <p>All three blocks check out. Now change an amount.</p>}
        </div>
        <p className="label mt-4 text-muted">Target: hashes ≤ {TARGET.toString(16).padStart(64, "0").slice(0, 12)}…</p>
      </section>
    </div>
  );
}
