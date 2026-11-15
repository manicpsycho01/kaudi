"use client";
import { useEffect, useMemo, useState } from "react";
import { useSim } from "@/lib/useSim";
import { NetworkStage } from "../NetworkStage";
import { Step } from "../VoyageShell";

/** Satoshi's whitepaper §11: probability an attacker with share q ever catches up from z blocks behind. */
export function catchUp(q: number, z: number) {
  const p = 1 - q;
  if (q >= p) return 1;
  const lambda = z * (q / p);
  let sum = 1;
  let poisson = Math.exp(-lambda);
  for (let k = 0; k <= z; k++) {
    if (k > 0) poisson *= lambda / k;
    sum -= poisson * (1 - Math.pow(q / p, z - k));
  }
  return Math.max(0, sum);
}

export function V6Corsair() {
  const sim = useSim({ seed: "corsair-6", warmupBlocks: 3 });
  const snap = sim.snap;
  const [refs, setRefs] = useState<{ pay: string; self: string } | null>(null);
  const [st, setSt] = useState({ armed: false, paid: false, shipped: false, revealed: false, robbed: false });
  const soc = snap?.nodes.find((n) => n.id === "socotra");
  const pay = snap?.watched.find((w) => w.txid === refs?.pay);
  const confAtCalicut = pay?.conf.calicut ?? 0;

  useEffect(() => {
    if (!snap) return;
    setSt((s) => ({
      ...s,
      armed: s.armed || (!!soc?.withhold && (soc?.hashrate ?? 0) > 0),
      shipped: s.shipped || (s.paid && confAtCalicut >= 1),
      // Only when Calicut actually dropped Dara's payment as a double spend.
      robbed: s.robbed || (s.revealed && confAtCalicut === 0 && snap.log.some((l) => l.kind === "drop" && l.node === "calicut" && l.ref === refs?.pay)),
    }));
  }, [snap, soc, confAtCalicut, refs]);

  const arm = async () => { await sim.act({ type: "hashrate", node: "socotra", value: 6000 }); await sim.act({ type: "withhold", node: "socotra", on: true }); };
  const strike = async () => {
    // The secret payment to himself goes first, only to his own island; then the public one to the merchant.
    const r = await sim.act({ type: "batch", actions: [{ type: "send", from: "corsair", to: "corsair", amount: "95", via: "socotra", relay: false }, { type: "send", from: "corsair", to: "dara", amount: "90", via: "calicut" }] });
    const [selfRef, payRef] = (r.ref ?? "").split(",");
    if (r.ok && selfRef && payRef) {
      setRefs({ pay: payRef, self: selfRef });
      await sim.act({ type: "watch", txid: payRef, label: "Corsair → Dara" });
      setSt((s) => ({ ...s, paid: true }));
    }
  };
  const publicSince = useMemo(() => snap?.nodes.find((n) => n.id === "calicut")?.height ?? 0, [snap]);

  return (
    <NetworkStage sim={sim} focus={undefined} steps={
      <>
        <Step n={1} done={st.armed} active={!st.armed} title="Arm Socotra and mine in secret">
          Give the Corsair&apos;s island 60% of all hash power. It mines its own chain and tells no one.
          {!st.armed && <button type="button" className="btn btn-signal mt-3" onClick={() => void arm()}>Arm the Corsair</button>}
        </Step>
        <Step n={2} done={st.paid} active={st.armed && !st.paid} title="Pay Dara for the pepper — and pay yourself the same coins in secret">
          The public payment goes to Dara at Calicut. A second payment spending the same coin goes only into Socotra&apos;s secret chain.
          {st.armed && !st.paid && <button type="button" className="btn mt-3" onClick={() => void strike()}>Make both payments</button>}
        </Step>
        <Step n={3} done={st.shipped} active={st.paid && !st.shipped} title="Wait until Dara sees the payment confirmed">
          {pay && <span className="mono block text-[13px]">At Calicut: {confAtCalicut ? `${confAtCalicut} confirmation${confAtCalicut === 1 ? "" : "s"}` : pay.pending.calicut ? "pending" : "—"}</span>}
          {st.shipped && <span className="mt-1 block text-kelp">Dara sees it in a block and hands over the pepper.</span>}
        </Step>
        <Step n={4} done={st.revealed} active={st.shipped && !st.revealed} title="Reveal the secret chain">
          {soc && <span className="mono block text-[13px]">Socotra&apos;s chain: #{soc.height} ({soc.secret} secret) · Calicut&apos;s: #{publicSince}</span>}
          {st.shipped && !st.revealed && (
            <button type="button" className="btn btn-signal mt-3" disabled={!soc || soc.height <= publicSince} onClick={() => { void sim.act({ type: "release", node: "socotra" }); setSt((s) => ({ ...s, revealed: true })); }}>
              {soc && soc.height <= publicSince ? "Wait — his chain must be longer" : "Reveal it"}
            </button>
          )}
        </Step>
        <Step n={5} done={st.robbed} active={st.revealed && !st.robbed} title="Watch Dara's payment vanish">
          Every port switches to the chain with more work. In it, the coin went back to the Corsair — so Dara&apos;s payment is now a double spend, and every port drops it.
        </Step>
      </>
    } extra={<Odds />} />
  );
}

function Odds() {
  const [q, setQ] = useState(0.3);
  const rows = [0, 1, 2, 3, 6, 10];
  return (
    <section className="mt-8 border border-line bg-sea-2 p-4 sm:p-5" aria-labelledby="odds-h">
      <h2 id="odds-h" className="display text-[1.4rem]">Why merchants wait for six</h2>
      <p className="mt-2 text-[15.5px] text-ink-2">With most of the hash power the Corsair always wins. With less, he must get lucky — and each extra confirmation makes that rarer. These odds are from §11 of the Bitcoin whitepaper.</p>
      <label className="mt-4 block"><span className="label text-muted">Attacker&apos;s share of hash power: {Math.round(q * 100)}%</span>
        <input type="range" min={0.05} max={0.6} step={0.05} value={q} onChange={(e) => setQ(+e.target.value)} className="mt-1 w-full" /></label>
      <table className="mt-3 w-full text-[15px]">
        <thead><tr className="label text-left text-muted"><th className="py-1.5 font-normal">Confirmations waited</th><th className="py-1.5 text-right font-normal">Chance the attack succeeds</th></tr></thead>
        <tbody>{rows.map((z) => { const pr = catchUp(q, z); return <tr key={z} className="border-t border-line-2"><td className="mono py-1.5">{z}</td><td className={`mono py-1.5 text-right ${pr > 0.1 ? "text-coral" : pr > 0.001 ? "text-amber" : "text-kelp"}`}>{pr >= 0.9995 ? "certain" : pr < 0.0000005 ? "< 0.0001%" : `${(pr * 100).toPrecision(2)}%`}</td></tr>; })}</tbody>
      </table>
    </section>
  );
}
