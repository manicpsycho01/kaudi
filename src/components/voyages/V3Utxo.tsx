"use client";
import { useEffect, useMemo, useState } from "react";
import { ChainState } from "@/chain/chainstate";
import { GENESIS, personKey } from "@/chain/genesis";
import { Mempool } from "@/chain/mempool";
import { mineAsync } from "@/chain/miner";
import { COIN } from "@/chain/params";
import { makeCoinbase, makeSpend } from "@/chain/tx";
import { outpoint, type Coin } from "@/chain/utxo";
import type { Reject } from "@/chain/validate";
import { parseAmount } from "@/sim/sim";
import { Cowrie } from "../Cowrie";
import { kaudi } from "../format";

const asha = personKey("asha"), bilal = personKey("bilal");

export function V3Utxo() {
  const [state, setState] = useState<{ chain: ChainState; pool: Mempool } | null>(null);
  const [allCoins, setAllCoins] = useState<Coin[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [amount, setAmount] = useState("30");
  const [fee, setFee] = useState("0.001");
  const [change, setChange] = useState(true);
  const [result, setResult] = useState<{ ok: true; fee: bigint; txid: string } | { ok: false; reject: Reject } | null>(null);
  const [version, setVersion] = useState(0);

  // One real block in which Asha split her 100 KAUDI into four coins.
  useEffect(() => {
    let live = true;
    (async () => {
      const chain = new ChainState(GENESIS);
      const split = makeSpend(asha, [{ txid: GENESIS.txs[0]!.id, vout: 0 }], [40n, 25n, 20n].map((k) => ({ amount: k * COIN, pkh: asha.pkh })).concat([{ amount: 15n * COIN - 100_000n, pkh: asha.pkh }]));
      const cb = makeCoinbase(1, [{ amount: 50n * COIN + 100_000n, pkh: new Uint8Array(20).fill(2) }], "Voyage 3");
      const { block } = await mineAsync({ version: 1, prevHash: GENESIS.hash, time: GENESIS.header.time + 8 }, [cb, split]);
      chain.accept(block, block.header.time + 10);
      if (!live) return;
      setState({ chain, pool: new Mempool(chain.view) });
      setAllCoins(chain.view.byOwner(asha.pkh));
    })();
    return () => { live = false; };
  }, []);

  const pool = state?.pool;
  const pendingCoins = useMemo(() => (pool ? pool.pendingView.byOwner(asha.pkh) : []), [pool, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const unspent = new Set(pendingCoins.map((c) => outpoint(c.txid, c.vout)));
  const shown = [...allCoins, ...pendingCoins.filter((c) => !allCoins.some((a) => a.txid === c.txid && a.vout === c.vout))];
  const sel = shown.filter((c) => picked.includes(outpoint(c.txid, c.vout)));
  const inSum = sel.reduce((s, c) => s + c.amount, 0n);
  const pay = parseAmount(amount) ?? 0n, f = parseAmount(fee) ?? 0n;
  const back = change ? inSum - pay - f : 0n;
  const actualFee = inSum - pay - (back > 0n ? back : 0n);

  const submit = () => {
    if (!state || !sel.length) return;
    const outs = [{ amount: pay, pkh: bilal.pkh }, ...(back > 0n ? [{ amount: back, pkh: asha.pkh }] : [])];
    try {
      const tx = makeSpend(asha, sel.map((c) => ({ txid: c.txid, vout: c.vout })), outs);
      if (state.pool.has(tx.id)) {
        setResult({ ok: false, reject: { code: "duplicate", rule: "That's the very same payment you already made — identical bytes, identical txid — so the network just ignores the copy.", detail: "Change the amount and try again to attempt a real double spend." } });
        return;
      }
      const r = state.pool.add(tx, state.chain.height + 1);
      setResult(r.ok ? { ok: true, fee: r.value, txid: tx.id } : { ok: false, reject: r.reject });
      if (r.ok) { setPicked([]); setVersion((v) => v + 1); }
    } catch {
      setResult({ ok: false, reject: { code: "tx-bad-amount", rule: "Every output must be a positive whole number of kani.", detail: "One of the amounts is negative." } });
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <section aria-labelledby="u1">
        <h2 id="u1" className="display text-[1.7rem]">Asha&apos;s purse</h2>
        <p className="mt-2 text-ink-2">Her wallet says 100 KAUDI, but the chain doesn&apos;t store a balance. It stores separate coins — unspent outputs of earlier transactions. Her wallet just adds them up.</p>
        {!state && <p className="mt-5 text-muted" role="status">Mining Asha&apos;s block…</p>}
        <ul className="mt-5 grid gap-2 sm:grid-cols-2" aria-label="Asha's coins">
          {shown.map((c) => {
            const k = outpoint(c.txid, c.vout), spent = !unspent.has(k), on = picked.includes(k);
            return (
              <li key={k}>
                <label className={`flex min-h-16 cursor-pointer items-center gap-3 border p-3 ${on ? "border-brass bg-sea-3" : "border-line bg-sea-2"} ${spent ? "opacity-55" : ""}`}>
                  <input type="checkbox" className="h-5 w-5 accent-[var(--color-brass)]" checked={on} onChange={() => setPicked((p) => (on ? p.filter((x) => x !== k) : [...p, k]))} />
                  <Cowrie className="h-8 w-auto text-brass" />
                  <span className="min-w-0">
                    <span className="mono block text-[16px]">{kaudi(c.amount)} <span className="text-[12px] text-muted">KAUDI</span></span>
                    <span className="hash block text-[11px] text-muted">{c.txid.slice(0, 10)}…:{c.vout}{spent ? " · spent (pending)" : c.height > 1 ? " · change, unconfirmed" : ""}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <p className="label mt-3 text-muted">Spent coins stay listed so you can try spending them twice.</p>
      </section>

      <section aria-labelledby="u2" className="border border-line bg-sea-2 p-4 sm:p-5">
        <h2 id="u2" className="display text-[1.4rem]">Pay Bilal</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label><span className="label text-muted">To Bilal (KAUDI)</span><input className="field mt-1" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          <label><span className="label text-muted">Fee you intend (KAUDI)</span><input className="field mt-1" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} disabled={!change} /></label>
        </div>
        <label className="mt-3 flex min-h-11 items-center gap-3"><input type="checkbox" className="h-5 w-5 accent-[var(--color-brass)]" checked={change} onChange={(e) => setChange(e.target.checked)} /><span>Send the rest back to Asha as change</span></label>
        <table className="mt-4 w-full text-[15.5px]">
          <caption className="sr-only">The transaction you are building</caption>
          <tbody>
            <tr className="border-t border-line-2"><th className="py-2 text-left font-normal text-muted">Coins in ({sel.length})</th><td className="mono py-2 text-right">{kaudi(inSum)}</td></tr>
            <tr className="border-t border-line-2"><th className="py-2 text-left font-normal text-muted">→ Bilal</th><td className="mono py-2 text-right">{kaudi(pay)}</td></tr>
            <tr className="border-t border-line-2"><th className="py-2 text-left font-normal text-muted">→ Asha (change)</th><td className="mono py-2 text-right">{back > 0n ? kaudi(back) : "—"}</td></tr>
            <tr className="border-t border-line"><th className="py-2 text-left font-normal">Left over = fee to the miner</th><td className={`mono py-2 text-right ${actualFee > COIN ? "text-coral" : ""}`} data-testid="fee">{kaudi(actualFee)}</td></tr>
          </tbody>
        </table>
        {!change && actualFee > COIN && <p className="mt-2 text-coral">Without a change output, everything you don&apos;t send is a tip for the miner — {kaudi(actualFee)} KAUDI. People really have lost fortunes this way.</p>}
        <button type="button" className="btn btn-signal mt-4 w-full" disabled={!sel.length || !state} onClick={submit}>Sign and check</button>
        <div className="mt-4" aria-live="polite">
          {result?.ok && <p className="text-kelp">✓ Valid. Fee {kaudi(result.fee)} KAUDI. The coins you used are now spent, and two new ones exist — Bilal&apos;s, and Asha&apos;s change.</p>}
          {result && !result.ok && <p data-testid="reject" className="text-coral">✗ Refused — {result.reject.code}<span className="block text-[15px] text-ink-2">{result.reject.rule} <span className="text-muted">{result.reject.detail}</span></span></p>}
        </div>
      </section>
    </div>
  );
}
