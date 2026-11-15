/// <reference lib="webworker" />
import { Sim, type Action } from "./sim";
import { blockDetail, snapshot, txDetail } from "./snapshot";
import type { PortId } from "./world";

export type ToWorker =
  | { type: "init"; seed: string; hashrates?: Partial<Record<PortId, number>>; script?: { t: number; action: Action }[]; warmup?: number; speed?: number; paused?: boolean }
  | { type: "act"; id: number; action: Action }
  | { type: "speed"; value: number }
  | { type: "pause"; value: boolean }
  | { type: "step"; ms: number }
  | { type: "block"; id: number; hash: string; at: PortId }
  | { type: "tx"; id: number; txid: string; at: PortId };
export type FromWorker =
  | { type: "snap"; snap: ReturnType<typeof snapshot>; speed: number; paused: boolean }
  | { type: "reply"; id: number; value: unknown };

let sim: Sim | null = null;
let speed = 1, paused = false, last = 0, lastSnap = 0;
const post = (m: FromWorker) => (self as unknown as Worker).postMessage(m);
const send = () => { if (sim) post({ type: "snap", snap: snapshot(sim), speed, paused }); };

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  if (m.type === "init") {
    sim = new Sim(m.seed, { hashrates: m.hashrates });
    for (const s of m.script ?? []) sim.schedule(s.t, s.action);
    if (m.warmup) sim.advance(m.warmup);
    speed = m.speed ?? 1; paused = !!m.paused; last = performance.now();
    send();
  } else if (!sim) return;
  else if (m.type === "act") { post({ type: "reply", id: m.id, value: sim.act(m.action) }); send(); }
  else if (m.type === "speed") { speed = m.value; send(); }
  else if (m.type === "pause") { paused = m.value; last = performance.now(); send(); }
  else if (m.type === "step") { sim.advance(m.ms); send(); }
  else if (m.type === "block") post({ type: "reply", id: m.id, value: blockDetail(sim, m.hash, m.at) });
  else if (m.type === "tx") post({ type: "reply", id: m.id, value: txDetail(sim, m.txid, m.at) });
};

// The clock: advance simulated time by real elapsed time × speed, capped so a background tab can't jump hours.
setInterval(() => {
  const now = performance.now();
  const dt = Math.min(now - last, 250);
  last = now;
  if (!sim || paused) return;
  const t0 = performance.now();
  sim.advance(Math.round(dt * speed));
  if (now - lastSnap > 90 || performance.now() - t0 > 30) { lastSnap = now; send(); }
}, 16);
