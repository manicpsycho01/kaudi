"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSim } from "@/lib/useSim";
import type { Action, ForgeKind } from "@/sim/sim";
import { BlockTree } from "./BlockTree";
import { Chart } from "./Chart";
import { Inspector, type Inspecting } from "./Inspector";
import { Controls, Log } from "./Panels";
import { NAME } from "./ports";
import { ShareRun } from "./ShareRun";
import type { PortId } from "@/sim/world";

type Trick = { id: string; title: string; plan: string; forge?: ForgeKind };
const TRICKS: Trick[] = [
  { id: "print", title: "Print money", plan: "Mine a block at Surat that pays its miner 1,000 KAUDI instead of 50.", forge: "overpay" },
  { id: "pick", title: "Pickpocket", plan: "Put Asha's coin in a block, signed with the Corsair's key.", forge: "steal" },
  { id: "lazy", title: "Skip the work", plan: "Publish a perfectly good block whose hash was never ground below the target.", forge: "nopow" },
  { id: "rewrite", title: "Rewrite history", plan: "Take a block from a few minutes ago and change who its reward went to.", forge: "rewrite" },
  { id: "twice", title: "Pay twice", plan: "Spend the same 60 KAUDI on Dara at Calicut and Chen at Malacca at the same moment." },
  { id: "outmine", title: "Outmine everyone", plan: "Rent 60% of all hash power, pay Dara, then publish a secret history where you didn't." },
];

type Verdict = { state: "running" | "caught" | "worked"; text: string; by?: string[] };

export function Heist({ replay }: { replay?: { seed: string; script: { t: number; action: Action }[] } }) {
  const sim = useSim(replay ? { seed: replay.seed, warmupBlocks: 5, script: replay.script } : { seed: "the-heist", warmupBlocks: 5 });
  const snap = sim.snap;
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const watch = useRef<Record<string, { since: number; refs: string[] }>>({});
  const [inspect, setInspect] = useState<Inspecting>(null);
  const load = useMemo(() => ({ block: sim.block, tx: sim.tx }), [sim.block, sim.tx]);
  const close = useCallback(() => setInspect(null), []);
  const set = (id: string, v: Verdict) => setVerdicts((x) => ({ ...x, [id]: v }));

  // Judge each attempt from what the ports actually did.
  useEffect(() => {
    if (!snap) return;
    for (const [id, w] of Object.entries(watch.current)) {
      const cur = verdicts[id];
      if (!cur || cur.state !== "running") continue;
      if (id === "twice") {
        const [a, b] = w.refs.map((r) => snap.watched.find((x) => x.txid === r));
        if (!a || !b) continue;
        const ca = Math.max(...Object.values(a.conf)), cb = Math.max(...Object.values(b.conf));
        if ((ca >= 2 && cb === 0) || (cb >= 2 && ca === 0)) {
          const won = ca ? "Dara" : "Chen", lost = ca ? "Chen" : "Dara";
          set(id, { state: "caught", text: `Both ports accepted their payment at first — each saw its own first. But only one can be mined: ${won} got paid, and every port refused ${lost}'s payment as a coin already spent.`, by: ["Every port"] });
        }
        continue;
      }
      if (id === "outmine") {
        const p = snap.watched.find((x) => x.txid === w.refs[0]);
        const soc = snap.nodes.find((n) => n.id === "socotra")!;
        const cal = snap.nodes.find((n) => n.id === "calicut")!;
        if (p && p.conf.calicut >= 1 && soc.withhold && soc.height > cal.height + 1) void sim.act({ type: "release", node: "socotra" });
        if (p && !soc.withhold && p.conf.calicut === 0 && snap.log.some((l) => l.t > w.since && l.kind === "drop" && l.ref === w.refs[0])) {
          set(id, { state: "worked", text: "Dara saw the payment confirmed and handed over the pepper. Then the Corsair's longer secret chain arrived — every port switched to it, and Dara's payment vanished. Every block followed every rule; he simply had more hash power than everyone else combined." });
          void sim.act({ type: "hashrate", node: "socotra", value: 0 });
        }
        continue;
      }
      const rejects = snap.log.filter((l) => l.kind === "reject" && l.ref === w.refs[0]);
      if (rejects.length) {
        const first = rejects[0]!;
        set(id, { state: "caught", text: `${first.text.replace(/^.*?: /, "")} ${first.detail ?? ""}`, by: [...new Set(rejects.map((r) => r.node!))].map((n) => NAME[n as PortId]) });
      }
    }
  }, [snap]); // eslint-disable-line react-hooks/exhaustive-deps

  const attempt = async (t: Trick) => {
    if (!snap) return;
    set(t.id, { state: "running", text: "Sailing…" });
    if (t.forge) {
      const r = await sim.act({ type: "forge", node: "surat", kind: t.forge });
      if (!r.ok || !r.ref) return set(t.id, { state: "caught", text: r.message });
      watch.current[t.id] = { since: snap.t, refs: [r.ref] };
    } else if (t.id === "twice") {
      const r = await sim.act({ type: "batch", actions: [{ type: "send", from: "corsair", to: "dara", amount: "60", via: "calicut" }, { type: "send", from: "corsair", to: "chen", amount: "60", via: "malacca" }] });
      const [ra, rb] = (r.ref ?? "").split(",");
      if (!r.ok || !ra || !rb) return set(t.id, { state: "caught", text: r.message });
      const a = { ref: ra }, b = { ref: rb };
      await sim.act({ type: "watch", txid: a.ref, label: "to Dara" });
      await sim.act({ type: "watch", txid: b.ref, label: "to Chen" });
      watch.current[t.id] = { since: snap.t, refs: [a.ref, b.ref] };
      set(t.id, { state: "running", text: "Two payments, one coin, sailing in opposite directions…" });
    } else {
      await sim.act({ type: "hashrate", node: "socotra", value: 6000 });
      await sim.act({ type: "withhold", node: "socotra", on: true });
      const r = await sim.act({ type: "batch", actions: [{ type: "send", from: "corsair", to: "corsair", amount: "30", via: "socotra", relay: false }, { type: "send", from: "corsair", to: "dara", amount: "25", via: "calicut" }] });
      const [selfRef, payRef] = (r.ref ?? "").split(",");
      if (!r.ok || !selfRef || !payRef) return set(t.id, { state: "caught", text: r.message });
      const self = { ref: selfRef }, p = { ref: payRef };
      await sim.act({ type: "watch", txid: p.ref, label: "to Dara" });
      watch.current[t.id] = { since: snap.t, refs: [p.ref, self.ref] };
      sim.setSpeed(4);
      set(t.id, { state: "running", text: "Socotra is mining in secret while Dara waits for a confirmation…" });
    }
  };

  const caught = Object.values(verdicts).filter((v) => v.state === "caught").length;
  const worked = Object.values(verdicts).filter((v) => v.state === "worked").length;

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-16 sm:px-8">
      <header className="grid gap-6 border-b border-line pt-8 pb-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12">
        <div>
          <p className="label text-coral">The heist</p>
          <h1 className="display mt-3 text-[clamp(2.4rem,5.5vw,4.4rem)]">Try to rob the chain</h1>
        </div>
        <div className="max-w-2xl self-end text-[17.5px] leading-relaxed text-ink-2">
          <p>Six classic ways to cheat a blockchain, run against a live network of eight ports. There&apos;s no referee and no admin — just every port checking every rule for itself. Five tricks get caught. One works, and it&apos;s the reason exchanges make you wait for confirmations.</p>
        </div>
      </header>

      <div className="grid gap-6 pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <section aria-labelledby="tricks-h">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="tricks-h" className="label text-brass">Your tricks</h2>
            <p className="label text-muted" aria-live="polite" data-testid="score">{caught} caught · {worked} worked · {TRICKS.length - caught - worked} untried</p>
          </div>
          <ol className="mt-3 space-y-3">
            {TRICKS.map((t, i) => {
              const v = verdicts[t.id];
              return (
                <li key={t.id} data-trick={t.id} data-state={v?.state ?? "untried"} className={`border p-4 ${v?.state === "caught" ? "border-kelp/50" : v?.state === "worked" ? "border-coral bg-coral-soft" : "border-line bg-sea-2"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline gap-3"><span className="display text-[1.4rem] text-brass">{String(i + 1).padStart(2, "0")}</span><span className="display text-[1.35rem]">{t.title}</span></p>
                      <p className="mt-1 text-[15.5px] text-ink-2">{t.plan}</p>
                    </div>
                    <button type="button" className={`btn ${v ? "" : "btn-signal"}`} disabled={!snap || v?.state === "running"} onClick={() => void attempt(t)}>{v?.state === "running" ? "Underway…" : v ? "Again" : "Try it"}</button>
                  </div>
                  {v && (
                    <div className="mt-3 border-t border-line-2 pt-3 text-[15px]" aria-live="polite">
                      <p className={`label ${v.state === "caught" ? "text-kelp" : v.state === "worked" ? "text-coral" : "text-amber"}`}>{v.state === "caught" ? `Caught${v.by ? ` by ${v.by.join(", ")}` : ""}` : v.state === "worked" ? "It worked" : "Underway"}</p>
                      <p className="mt-1 text-ink-2">{v.text}</p>
                      {v.state === "worked" && <Link href="/voyages/the-corsair" className="label mt-2 inline-flex min-h-11 items-center text-brass underline-offset-4 hover:underline">Why it worked, and the defence →</Link>}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        <section className="min-w-0" aria-label="The network">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><Controls sim={sim} compact /><ShareRun sim={sim} path="/heist" /></div>
          <div className="neat bg-sea-2 p-1"><Chart snap={snap} received={sim.received} /></div>
          <BlockTree snap={snap} className="mt-4 border border-line bg-sea" onSelect={(hash) => setInspect({ kind: "block", hash })} />
          <h2 className="label mt-5 text-brass">Ship&apos;s log</h2>
          <div className="mt-2 max-h-[18rem] overflow-y-auto overscroll-contain pr-1" data-lenis-prevent><Log snap={snap} onOpen={setInspect} limit={30} /></div>
        </section>
      </div>
      <Inspector what={inspect} at="calicut" load={load} onClose={close} onOpen={setInspect} />
    </div>
  );
}
