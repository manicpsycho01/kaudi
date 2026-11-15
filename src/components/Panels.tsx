"use client";
import { useState } from "react";
import type { Action, ForgeKind, LogEntry } from "@/sim/sim";
import type { Snap } from "@/sim/snapshot";
import type { PortId } from "@/sim/world";
import type { SimHandle } from "@/lib/useSim";
import { clock, kaudi } from "./format";
import { NAME } from "./ports";
import type { Inspecting } from "./Inspector";

export function Controls({ sim, compact }: { sim: SimHandle; compact?: boolean }) {
  const { snap, speed, paused } = sim;
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Simulation controls">
      <span className="label mr-1 min-w-[5.5rem] text-brass" aria-label="Simulated time">T+ {clock(snap?.t ?? 0)}</span>
      <button type="button" className="btn !px-3" onClick={() => sim.setPaused(!paused)} aria-pressed={paused}>{paused ? "▶ Run" : "❚❚ Pause"}</button>
      <div className="flex" role="radiogroup" aria-label="Speed">
        {[1, 4, 16].map((v) => (
          <button key={v} type="button" role="radio" aria-checked={speed === v} className={`btn !px-3 -ml-px first:ml-0 ${speed === v ? "!border-brass !text-brass" : ""}`} onClick={() => sim.setSpeed(v)}>{v}×</button>
        ))}
      </div>
      {!compact && <button type="button" className="btn !px-3" onClick={() => sim.step(8000)} title="Advance 8 simulated seconds">+8 s</button>}
    </div>
  );
}

export function MonsoonButton({ sim }: { sim: SimHandle }) {
  const on = !!sim.snap?.monsoon;
  return (
    <button type="button" className={`btn ${on ? "!border-coral !text-coral" : ""}`} aria-pressed={on} onClick={() => void sim.act({ type: "monsoon", on: !on })}>
      {on ? "Lift the monsoon" : "Bring the monsoon"}
    </button>
  );
}

export function Wallets({ sim, onOpen, people }: { sim: SimHandle; onOpen?: (w: Inspecting) => void; people?: string[] }) {
  const snap = sim.snap;
  const list = (snap?.people ?? []).filter((p) => !people || people.includes(p.id));
  const [from, setFrom] = useState(list[0]?.id ?? "asha");
  const [to, setTo] = useState("bilal");
  const [amount, setAmount] = useState("5");
  const [msg, setMsg] = useState<{ ok: boolean; text: string; ref?: string } | null>(null);
  const send = async () => {
    const r = await sim.act({ type: "send", from, to, amount });
    setMsg({ ok: r.ok, text: r.ok ? `Sent. Watch the amber dot sail out from ${NAME[list.find((p) => p.id === from)?.home ?? "aden"]}.` : r.message, ref: r.ref });
  };
  return (
    <div>
      <table className="w-full text-[15px]">
        <caption className="sr-only">Wallet balances, as each person's home port sees them</caption>
        <thead><tr className="label text-left text-muted"><th className="py-2 font-normal">Wallet</th><th className="py-2 font-normal">Home</th><th className="py-2 text-right font-normal">Confirmed</th><th className="py-2 text-right font-normal">Pending</th></tr></thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id} className="border-t border-line-2">
              <td className="py-2 pr-2">{p.name}</td>
              <td className="label py-2 pr-2 text-muted">{NAME[p.home]}</td>
              <td className="mono py-2 text-right text-[14px]">{kaudi(p.confirmed, 3)}</td>
              <td className={`mono py-2 text-right text-[14px] ${p.pending !== p.confirmed ? "text-amber" : "text-muted"}`}>{kaudi(p.pending, 3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <form className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_7rem_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <label className="block"><span className="label text-muted">From</span>
          <select className="field mt-1" value={from} onChange={(e) => setFrom(e.target.value)}>{list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="block"><span className="label text-muted">To</span>
          <select className="field mt-1" value={to} onChange={(e) => setTo(e.target.value)}>{(snap?.people ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="block"><span className="label text-muted">KAUDI</span>
          <input className="field mt-1" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount in KAUDI" /></label>
        <button type="submit" className="btn btn-signal">Send</button>
      </form>
      <p className="label mt-2 text-muted">Fee 0.001 KAUDI goes to whichever port mines it.</p>
      {msg && <p role="status" className={`mt-3 text-[15px] ${msg.ok ? "text-kelp" : "text-coral"}`}>{msg.text} {msg.ref && onOpen && <button type="button" className="underline underline-offset-4" onClick={() => onOpen({ kind: "tx", id: msg.ref! })}>Inspect</button>}</p>}
    </div>
  );
}

const FORGES: { kind: ForgeKind; label: string }[] = [
  { kind: "overpay", label: "Pay the miner 1,000 KAUDI" },
  { kind: "steal", label: "Spend Asha's coin without her key" },
  { kind: "nopow", label: "Skip the proof of work" },
  { kind: "future", label: "Stamp it an hour in the future" },
  { kind: "rewrite", label: "Rewrite an old block" },
];

export function Ports({ sim, selected, onSelect, forge = true }: { sim: SimHandle; selected?: PortId | null; onSelect?: (p: PortId) => void; forge?: boolean }) {
  const snap = sim.snap;
  const [kind, setKind] = useState<ForgeKind>("overpay");
  const [who, setWho] = useState<PortId>("surat");
  const [msg, setMsg] = useState("");
  const total = (snap?.nodes ?? []).reduce((s, n) => s + (n.online ? n.hashrate : 0), 0) || 1;
  const act = (a: Action) => void sim.act(a);
  return (
    <div>
      <ul className="divide-y divide-line-2">
        {snap?.nodes.map((n) => (
          <li key={n.id} className={`py-3 ${selected === n.id ? "bg-sea-3/60" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <button type="button" className="display min-h-11 text-left text-[17px] hover:text-brass" onClick={() => onSelect?.(n.id)}>{n.name}</button>
              <span className="label text-muted">block #{n.height} · {n.mempool} pending · {Math.round((100 * (n.online ? n.hashrate : 0)) / total)}% power</span>
            </div>
            <div className="mt-1 grid grid-cols-[1fr_auto] items-center gap-3">
              <label className="flex items-center gap-3"><span className="sr-only">{n.name} hash power</span>
                <input type="range" min={0} max={9000} step={100} value={n.hashrate} className="w-full" onChange={(e) => act({ type: "hashrate", node: n.id, value: +e.target.value })} aria-label={`${n.name} hash power, hashes per simulated second`} />
              </label>
              <button type="button" className={`btn !min-h-11 !px-3 ${!n.online ? "!border-coral !text-coral" : ""}`} aria-pressed={!n.online} onClick={() => act({ type: "online", node: n.id, online: !n.online })}>{n.online ? "Online" : "Offline"}</button>
            </div>
            {(n.withhold || n.id === "socotra") && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={`btn !min-h-11 !px-3 ${n.withhold ? "!border-coral !text-coral" : ""}`} aria-pressed={n.withhold} onClick={() => act({ type: "withhold", node: n.id, on: !n.withhold })}>{n.withhold ? "Mining in secret" : "Mine in secret"}</button>
                <button type="button" className="btn !min-h-11 !px-3" disabled={!n.secret} onClick={() => act({ type: "release", node: n.id })}>Reveal {n.secret || ""} secret block{n.secret === 1 ? "" : "s"}</button>
              </div>
            )}
            {n.lastReject && snap && snap.t - n.lastReject.t < 30_000 && (
              <p className="mt-2 border-l-2 border-coral pl-3 text-[14px] text-ink-2"><span className="label text-coral">Rejected {n.lastReject.what}</span><br />{n.lastReject.rule} <span className="text-muted">{n.lastReject.detail}</span></p>
            )}
          </li>
        ))}
      </ul>
      {forge && (
        <div className="mt-6 border-t border-line pt-4">
          <h3 className="label text-brass">Forge a block</h3>
          <p className="mt-1 text-[15px] text-ink-2">Have a port cheat, and watch its neighbours check the rules and refuse.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_9rem_auto]">
            <select className="field" value={kind} onChange={(e) => setKind(e.target.value as ForgeKind)} aria-label="What to forge">{FORGES.map((f) => <option key={f.kind} value={f.kind}>{f.label}</option>)}</select>
            <select className="field" value={who} onChange={(e) => setWho(e.target.value as PortId)} aria-label="Which port cheats">{snap?.nodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select>
            <button type="button" className="btn" onClick={async () => { const r = await sim.act({ type: "forge", node: who, kind }); setMsg(r.ok ? `${NAME[who]} sent it out. Watch the log.` : r.message); }}>Broadcast</button>
          </div>
          {msg && <p role="status" className="mt-2 text-[15px] text-ink-2">{msg}</p>}
        </div>
      )}
    </div>
  );
}

const TONE: Record<LogEntry["kind"], string> = { mined: "text-ink", reorg: "text-amber", reject: "text-coral", tx: "text-ink-2", net: "text-brass", info: "text-ink-2", drop: "text-coral" };
export function Log({ snap, onOpen, kinds, limit = 40 }: { snap: Snap | null; onOpen?: (w: Inspecting) => void; kinds?: LogEntry["kind"][]; limit?: number }) {
  const entries = (snap?.log ?? []).filter((l) => !kinds || kinds.includes(l.kind)).slice(-limit).reverse();
  return (
    <ol className="space-y-2" aria-label="Ship's log, newest first">
      {entries.map((l, i) => (
        <li key={l.t + ":" + i + l.text} className="grid grid-cols-[3.4rem_1fr] gap-2 text-[14.5px] leading-snug">
          <span className="mono pt-0.5 text-[12px] text-muted">{clock(l.t)}</span>
          <p className={TONE[l.kind]}>
            {l.text}
            {l.detail && <span className="block text-[13.5px] text-muted">{l.detail}</span>}
            {l.ref && onOpen && l.ref.length === 64 && (l.kind === "mined" || l.kind === "tx" || l.kind === "drop") && (
              <button type="button" className="label ml-1 text-brass underline-offset-4 hover:underline" onClick={() => onOpen(l.kind === "tx" || l.kind === "drop" ? { kind: "tx", id: l.ref! } : { kind: "block", hash: l.ref! })}>inspect</button>
            )}
          </p>
        </li>
      ))}
      {!entries.length && <li className="text-muted">Nothing yet.</li>}
    </ol>
  );
}
