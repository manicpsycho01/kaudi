"use client";
import { useCallback, useMemo, useState } from "react";
import { useSim } from "@/lib/useSim";
import type { PortId } from "@/sim/world";
import { BlockTree } from "./BlockTree";
import { Chart } from "./Chart";
import { Inspector, type Inspecting } from "./Inspector";
import { PortSheet } from "./PortSheet";
import { Controls, Log, MonsoonButton, Ports, Wallets } from "./Panels";
import { NAME } from "./ports";
import type { Run } from "./Replayable";
import { ShareRun } from "./ShareRun";

const TABS = [{ id: "wallets", label: "Wallets" }, { id: "ports", label: "Ports" }, { id: "log", label: "Log" }] as const;

/** Free play: the whole network and every control. */
export function Sea({ replay }: { replay?: Run | null }) {
  const sim = useSim(replay ? { seed: replay.seed, script: replay.script, warmupBlocks: 6 } : { seed: "the-open-sea", warmupBlocks: 6 });
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("wallets");
  const [port, setPort] = useState<PortId>("calicut");
  const [sheet, setSheet] = useState<PortId | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
  const openPort = useCallback((p: PortId) => { setPort(p); setSheet(p); }, []);
  const [inspect, setInspect] = useState<Inspecting>(null);
  const load = useMemo(() => ({ block: sim.block, tx: sim.tx }), [sim.block, sim.tx]);
  const close = useCallback(() => setInspect(null), []);

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-16 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pt-6 pb-4">
        <div>
          <h1 className="display text-[clamp(2rem,4.5vw,3.4rem)]">The open sea</h1>
          <p className="mt-1 max-w-2xl text-ink-2">Eight ports, one chain — when they agree. Click a port to open it and see the chain through its eyes, a lane to cut it, a block to inspect it.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2"><Controls sim={sim} /><MonsoonButton sim={sim} /><ShareRun sim={sim} path="/sea" /></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(360px,1fr)]">
        <div className="min-w-0">
          <div className="neat bg-sea-2 p-1">
            <Chart snap={sim.snap} received={sim.received} selected={port} onPort={openPort} onRoute={(a, b, cut) => void sim.act({ type: "route", a, b, cut })} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 label text-muted" aria-hidden>
            <span><span className="mr-1.5 inline-block h-2.5 w-2.5 bg-ink align-middle" style={{ clipPath: "polygon(30% 0,100% 70%,30% 70%)" }} />block in flight</span>
            <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber align-middle" />payment in flight</span>
            <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full border border-ink align-middle" />chain sync</span>
            <span className="text-coral">— — lane closed</span>
          </div>
          <section className="mt-6" aria-labelledby="tree-h">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="tree-h" className="label text-brass">The chain, every branch</h2>
              <p className="label text-muted">Tags under a block = ports whose best chain ends there</p>
            </div>
            <BlockTree snap={sim.snap} port={port} className="mt-2 border border-line bg-sea" onSelect={(hash) => setInspect({ kind: "block", hash })} />
          </section>
        </div>

        <aside className="min-w-0 border border-line bg-sea-2" aria-label="Controls">
          <div role="tablist" aria-label="Panels" className="grid grid-cols-3 border-b border-line">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} id={`tab-${t.id}`}
                className={`label min-h-12 border-b-2 ${tab === t.id ? "border-brass text-brass" : "border-transparent text-ink-2 hover:text-ink"}`} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="p-4 sm:p-5">
            {tab === "wallets" && <Wallets sim={sim} onOpen={setInspect} />}
            {tab === "ports" && <Ports sim={sim} selected={port} onSelect={openPort} />}
            {tab === "log" && <Log snap={sim.snap} onOpen={setInspect} />}
          </div>
          <p className="label border-t border-line px-4 py-3 text-muted sm:px-5">Highlighted in the tree: {NAME[port]}&apos;s chain · <button type="button" className="text-brass underline-offset-4 hover:underline" onClick={() => openPort(port)}>open {NAME[port]}</button></p>
        </aside>
      </div>
      <PortSheet sim={sim} port={inspect ? null : sheet} onClose={closeSheet} onOpen={setInspect} />
      <Inspector what={inspect} at={port} load={load} onClose={close} onOpen={setInspect} />
    </div>
  );
}
