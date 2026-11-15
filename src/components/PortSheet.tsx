"use client";
import { useEffect, useRef, useState } from "react";
import type { SimHandle } from "@/lib/useSim";
import type { PortDetail } from "@/sim/snapshot";
import type { PortId } from "@/sim/world";
import { clock, kaudi } from "./format";
import { minerCode, NAME } from "./ports";
import type { Inspecting } from "./Inspector";

/** A side sheet showing the chain through one port's eyes. Refreshes while open. */
export function PortSheet({ sim, port, onClose, onOpen }: { sim: SimHandle; port: PortId | null; onClose: () => void; onOpen: (w: Inspecting) => void }) {
  const [d, setD] = useState<PortDetail | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const t = sim.snap?.t ?? 0;
  useEffect(() => { if (port) void sim.port(port).then(setD); else setD(null); }, [port, sim, Math.floor(t / 1000)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!port) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", k);
    return () => { removeEventListener("keydown", k); prev?.focus?.({ preventScroll: true }); };
  }, [port, onClose]);
  if (!port) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-sea/50 backdrop-blur-[2px]" onClick={onClose}>
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${NAME[port]}: the chain through its eyes`}
        className="h-full w-full max-w-[520px] overflow-y-auto overscroll-contain border-l border-line bg-sea-2 px-5 py-6 outline-none sm:px-7" onClick={(e) => e.stopPropagation()} data-lenis-prevent>
        <div className="flex items-start justify-between gap-4">
          <p className="label text-brass">Port · the chain through its eyes</p>
          <button type="button" className="btn !min-h-11 !px-3" onClick={onClose} aria-label="Close">Esc ×</button>
        </div>
        {!d ? <p className="mt-6 text-muted">Loading…</p> : (
          <>
            <h2 className="display mt-3 text-4xl">{d.name}</h2>
            <p className="mt-1 text-ink-2 italic">{d.note}</p>
            <dl className="mt-5 grid grid-cols-3 gap-px border border-line bg-line text-center">
              <Stat k="Chain height" v={`#${d.height}`} />
              <Stat k="Hash power" v={`${Math.round(d.share * 100)}%`} />
              <Stat k="Status" v={!d.online ? "offline" : d.withhold ? "secret" : "online"} tone={!d.online || d.withhold ? "text-coral" : "text-kelp"} />
            </dl>
            <p className="mt-3 text-[15px] text-ink-2" data-testid="agrees">
              {d.agreesWith.length === 7 ? "Agrees with every other port." : d.agreesWith.length ? `Same tip as ${d.agreesWith.map((p) => NAME[p]).join(", ")}; the others see a different chain.` : "No other port has the same tip right now — it's on its own branch."}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className={`btn !min-h-11 !px-3 ${!d.online ? "!border-coral !text-coral" : ""}`} onClick={() => void sim.act({ type: "online", node: port, online: !d.online })}>{d.online ? "Take offline" : "Bring back online"}</button>
              <button type="button" className={`btn !min-h-11 !px-3 ${d.withhold ? "!border-coral !text-coral" : ""}`} onClick={() => void sim.act({ type: "withhold", node: port, on: !d.withhold })}>{d.withhold ? "Stop mining in secret" : "Mine in secret"}</button>
              {d.secret > 0 && <button type="button" className="btn !min-h-11 !px-3" onClick={() => void sim.act({ type: "release", node: port })}>Reveal {d.secret} secret block{d.secret === 1 ? "" : "s"}</button>}
            </div>
            <label className="mt-4 block"><span className="label text-muted">Hash power: {d.hashrate.toLocaleString("en-US")} hashes per simulated second</span>
              <input type="range" min={0} max={9000} step={100} value={d.hashrate} className="mt-1 w-full" onChange={(e) => void sim.act({ type: "hashrate", node: port, value: +e.target.value })} /></label>

            <Section title="Its latest blocks">
              <ol className="space-y-1.5">
                {d.chain.map((b) => (
                  <li key={b.hash}><button type="button" className="flex w-full min-h-9 items-baseline justify-between gap-3 text-left hover:text-brass" onClick={() => onOpen({ kind: "block", hash: b.hash })}>
                    <span className="mono text-[14px]">#{b.height} <span className="text-muted">{b.hash.slice(0, 14)}…</span></span><span className="label text-muted">{minerCode(b.miner)} · {b.txs} tx</span>
                  </button></li>
                ))}
              </ol>
            </Section>

            <Section title="Balances, as this port sees them">
              <table className="w-full text-[15px]"><tbody>
                {d.balances.map((b) => <tr key={b.name} className="border-t border-line-2 first:border-t-0"><td className="py-1.5">{b.name}</td><td className="mono py-1.5 text-right text-[14px]">{kaudi(b.confirmed, 3)}</td><td className={`mono py-1.5 pl-3 text-right text-[14px] ${b.pending !== b.confirmed ? "text-amber" : "text-muted"}`}>{b.pending !== b.confirmed ? `→ ${kaudi(b.pending, 3)}` : ""}</td></tr>)}
              </tbody></table>
              <p className="label mt-2 text-muted">During a fork or a monsoon, ports can disagree about these.</p>
            </Section>

            <Section title={`Waiting to be mined (${d.mempool.length})`}>
              {d.mempool.length ? <ul className="space-y-1">{d.mempool.map((m) => <li key={m.id}><button type="button" className="min-h-9 text-left text-[15px] hover:text-brass" onClick={() => onOpen({ kind: "tx", id: m.id })}>{m.label} <span className="label text-muted">fee {kaudi(m.fee)}</span></button></li>)}</ul> : <p className="text-[15px] text-muted">Nothing pending.</p>}
            </Section>

            <Section title="Sea lanes">
              <ul className="space-y-1 text-[15px]">{d.peers.map((p) => <li key={p.id} className="flex justify-between gap-3"><span>{p.name}</span><span className={`label ${p.up ? "text-muted" : "text-coral"}`}>{p.up ? `${(p.latencyMs / 1000).toFixed(1)} s by sea` : "closed"}</span></li>)}</ul>
            </Section>

            <Section title="Recently refused">
              {d.rejects.length ? <ul className="space-y-2">{d.rejects.map((r, i) => <li key={i} className="border-l-2 border-coral pl-3 text-[14.5px]"><span className="label text-coral">{clock(r.t)} · {r.what}</span><br />{r.rule} <span className="text-muted">{r.detail}</span></li>)}</ul> : <p className="text-[15px] text-muted">Nothing — every block and payment it saw followed the rules.</p>}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ k, v, tone = "text-ink" }: { k: string; v: string; tone?: string }) {
  return <div className="bg-sea px-2 py-3"><dt className="label text-muted">{k}</dt><dd className={`display mt-1 text-[1.35rem] ${tone}`}>{v}</dd></div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-6 border-t border-line pt-4"><h3 className="label mb-2 text-brass">{title}</h3>{children}</section>;
}
