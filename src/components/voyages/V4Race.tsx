"use client";
import { useEffect, useRef, useState } from "react";
import { useSim } from "@/lib/useSim";
import { NetworkStage } from "../NetworkStage";
import { Step } from "../VoyageShell";

export function V4Race() {
  const sim = useSim({ seed: "the-race-4", warmupBlocks: 3 });
  const snap = sim.snap;
  const start = useRef<number | null>(null);
  const [seen, setSeen] = useState({ sailed: false, tie: false, resolved: false });
  const [boosted, setBoosted] = useState(false);

  useEffect(() => {
    if (!snap) return;
    if (start.current === null) start.current = snap.t;
    const after = snap.log.filter((l) => l.t > start.current!);
    const byHeight = new Map<number, number>();
    for (const b of snap.tree) if (b.foundAt > start.current!) byHeight.set(b.height, (byHeight.get(b.height) ?? 0) + 1);
    setSeen((s) => ({
      sailed: s.sailed || after.some((l) => l.kind === "mined"),
      tie: s.tie || [...byHeight.values()].some((c) => c > 1),
      resolved: s.resolved || (s.tie && after.some((l) => l.kind === "reorg")),
    }));
  }, [snap]);

  const boost = () => { setBoosted(true); void sim.act({ type: "hashrate", node: "zanzibar", value: 3000 }); void sim.act({ type: "hashrate", node: "malacca", value: 3000 }); sim.setSpeed(4); };

  return (
    <NetworkStage sim={sim} steps={
      <>
        <Step n={1} done={seen.sailed} active={!seen.sailed} title="Watch a port find a block and send it out">
          A coral ripple marks the winner. The little sails are the block crossing each lane; the numbers under each port are the height of the chain it believes in.
        </Step>
        <Step n={2} done={seen.tie} active={seen.sailed && !seen.tie} title="Catch two ports winning at the same height">
          Far-apart ports hear about each other&apos;s blocks late. If one finds a block before the news arrives, the chain forks — two blocks, same height, both valid.
          {!seen.tie && <span className="mt-3 block"><button type="button" className="btn" onClick={boost} disabled={boosted}>{boosted ? "Zanzibar and Malacca are racing" : "Make it likelier"}</button><span className="label mt-2 block text-muted">Gives the two most distant ports far more hash power, at 4× speed</span></span>}
        </Step>
        <Step n={3} done={seen.resolved} active={seen.tie && !seen.resolved} title="See the tie break">
          Whichever branch gets the next block has more work. Every port switches to it; the other block is orphaned — still valid, just not history.
        </Step>
      </>
    } />
  );
}
