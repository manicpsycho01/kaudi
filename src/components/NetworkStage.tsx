"use client";
import { useCallback, useMemo, useState } from "react";
import type { SimHandle } from "@/lib/useSim";
import type { PortId } from "@/sim/world";
import { BlockTree } from "./BlockTree";
import { Chart } from "./Chart";
import { Inspector, type Inspecting } from "./Inspector";
import { Controls, Log } from "./Panels";

/** Chart, block tree and log for the network voyages, with the steps alongside. */
export function NetworkStage({ sim, steps, focus, extra }: { sim: SimHandle; steps: React.ReactNode; focus?: PortId[]; extra?: React.ReactNode }) {
  const [inspect, setInspect] = useState<Inspecting>(null);
  const [port, setPort] = useState<PortId>("calicut");
  const load = useMemo(() => ({ block: sim.block, tx: sim.tx }), [sim.block, sim.tx]);
  const close = useCallback(() => setInspect(null), []);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(340px,1fr)]">
      <div className="min-w-0">
        <div className="mb-3"><Controls sim={sim} compact /></div>
        <div className="neat bg-sea-2 p-1"><Chart snap={sim.snap} received={sim.received} selected={port} onPort={setPort} focus={focus} /></div>
        <h2 className="label mt-6 text-brass">The chain, every branch</h2>
        <BlockTree snap={sim.snap} className="mt-2 border border-line bg-sea" onSelect={(hash) => setInspect({ kind: "block", hash })} />
        {extra}
      </div>
      <aside className="min-w-0" aria-label="Steps">
        <ol className="border-b border-line">{steps}</ol>
        <h2 className="label mt-6 text-brass">Ship&apos;s log</h2>
        <div className="mt-2 max-h-[22rem] overflow-y-auto overscroll-contain pr-1" data-lenis-prevent><Log snap={sim.snap} onOpen={setInspect} limit={30} /></div>
      </aside>
      <Inspector what={inspect} at={port} load={load} onClose={close} onOpen={setInspect} />
    </div>
  );
}
