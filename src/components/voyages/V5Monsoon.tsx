"use client";
import { useEffect, useRef, useState } from "react";
import { useSim } from "@/lib/useSim";
import { WEST } from "@/sim/world";
import { NetworkStage } from "../NetworkStage";
import { Step } from "../VoyageShell";

export function V5Monsoon() {
  const sim = useSim({ seed: "monsoon-5", warmupBlocks: 3, hashrates: { aden: 1400 }, speed: 4 });
  const snap = sim.snap;
  const split = useRef<{ west: number; east: number } | null>(null);
  const liftedAt = useRef<number | null>(null);
  const [st, setSt] = useState({ split: false, diverged: false, sent: false, lifted: false, reorged: false });
  const [payRef, setPayRef] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!snap) return;
    const h = (id: string) => snap.nodes.find((n) => n.id === id)!.height;
    if (snap.monsoon && !split.current) split.current = { west: h("aden"), east: h("kolkata") };
    if (split.current && !snap.monsoon && liftedAt.current === null) liftedAt.current = snap.t;
    setSt((s) => {
      const diverged = s.diverged || (!!split.current && snap.monsoon && h("aden") > split.current.west && h("kolkata") > split.current.east);
      const lifted = s.lifted || (diverged && !snap.monsoon);
      const reorged = s.reorged || (lifted && liftedAt.current !== null && snap.log.some((l) => l.kind === "reorg" && l.t >= liftedAt.current! && l.node && (WEST as string[]).includes(l.node)));
      return { ...s, split: s.split || snap.monsoon, diverged, lifted, reorged };
    });
  }, [snap]);

  const pay = async () => {
    const r = await sim.act({ type: "send", from: "esi", to: "farah", amount: "10" });
    if (r.ok && r.ref) { setPayRef(r.ref); void sim.act({ type: "watch", txid: r.ref, label: "Esi → Farah" }); setSt((s) => ({ ...s, sent: true })); setMsg(""); } else setMsg(r.message);
  };
  const w = snap?.watched.find((x) => x.txid === payRef);

  return (
    <NetworkStage sim={sim} steps={
      <>
        <Step n={1} done={st.split} active={!st.split} title="Bring the monsoon">
          The west (Zanzibar, Aden, Socotra) is cut off from India and the east. Nobody crashes — they just stop hearing each other.
          {!st.split && <button type="button" className="btn btn-signal mt-3" onClick={() => void sim.act({ type: "monsoon", on: true })}>Bring the monsoon</button>}
        </Step>
        <Step n={2} done={st.diverged} active={st.split && !st.diverged} title="Watch each half mine its own chain">
          Both sides keep finding blocks on their own branch. The west has about a third of the hash power, so its branch grows slower.
        </Step>
        <Step n={3} done={st.sent} active={st.diverged && !st.sent} title="Send Esi's payment from Zanzibar to Farah in Kolkata">
          Esi&apos;s port sees it and the west mines it. Farah&apos;s port never hears of it.
          {st.diverged && !st.sent && snap?.monsoon && <button type="button" className="btn mt-3" onClick={() => void pay()}>Esi pays Farah 10 KAUDI</button>}
          {msg && <span className="mt-2 block text-coral">{msg}</span>}
          {w && <span className="mono mt-2 block text-[13px]">Zanzibar: {w.conf.zanzibar ? `${w.conf.zanzibar} conf` : w.pending.zanzibar ? "pending" : "—"} · Kolkata: {w.conf.kolkata ? `${w.conf.kolkata} conf` : w.pending.kolkata ? "pending" : "never heard of it"}</span>}
        </Step>
        <Step n={4} done={st.lifted} active={st.sent && !st.lifted} title="Lift the monsoon">
          {st.sent && !st.lifted && <button type="button" className="btn btn-signal" onClick={() => void sim.act({ type: "monsoon", on: false })}>Lift the monsoon</button>}
        </Step>
        <Step n={5} done={st.reorged} active={st.lifted && !st.reorged} title="The west throws its branch away">
          The ports compare chains. The east&apos;s has more work, so the west reorganises onto it: its blocks are orphaned, and Esi&apos;s payment goes back to waiting — then gets mined again on the winning chain.
        </Step>
      </>
    } />
  );
}
