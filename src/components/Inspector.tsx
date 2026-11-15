"use client";
import { useEffect, useRef, useState } from "react";
import type { BlockDetail, TxDetail } from "@/sim/snapshot";
import type { PortId } from "@/sim/world";
import { kaudi } from "./format";
import { CODE, minerName, NAME } from "./ports";

export type Inspecting = { kind: "block"; hash: string } | { kind: "tx"; id: string } | null;

/** Side sheet that explains one block or transaction, field by field, as seen from one port. */
export function Inspector({ what, at, load, onClose, onOpen }: {
  what: Inspecting; at: PortId;
  load: { block: (h: string, at: PortId) => Promise<BlockDetail | null>; tx: (id: string, at: PortId) => Promise<TxDetail | null> };
  onClose: () => void; onOpen: (w: Inspecting) => void;
}) {
  const [block, setBlock] = useState<BlockDetail | null>(null);
  const [tx, setTx] = useState<TxDetail | null>(null);
  const [proofFor, setProofFor] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setBlock(null); setTx(null); setProofFor(null); setMissing(false);
    if (what?.kind === "block") void load.block(what.hash, at).then((b) => { setBlock(b); setMissing(!b); });
    if (what?.kind === "tx") void load.tx(what.id, at).then((t) => { setTx(t); setMissing(!t); });
  }, [what, at, load]);
  useEffect(() => {
    if (!what) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", k);
    return () => { removeEventListener("keydown", k); prev?.focus?.(); };
  }, [what, onClose]);
  if (!what) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-sea/60 backdrop-blur-[2px]" onClick={onClose}>
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={what.kind === "block" ? "Block details" : "Transaction details"}
        className="h-full w-full max-w-[560px] overflow-y-auto overscroll-contain border-l border-line bg-sea-2 px-5 py-6 outline-none sm:px-8" onClick={(e) => e.stopPropagation()} data-lenis-prevent>
        <div className="flex items-start justify-between gap-4">
          <p className="label text-brass">{what.kind === "block" ? "Block" : "Transaction"} · as seen from {NAME[at]}</p>
          <button type="button" className="btn !min-h-11 !px-3" onClick={onClose} aria-label="Close">Esc ×</button>
        </div>
        {!block && !tx && <p className="mt-6 text-muted">{missing ? "No port has accepted this one, so there's nothing on any chain to show." : "Loading…"}</p>}
        {block && (
          <>
            <h2 className="display mt-4 text-4xl">Block #{block.height}</h2>
            <p className="mt-2 text-ink-2">Mined by {minerName(block.miner)}. {block.mainOf.length ? `On the main chain at ${block.mainOf.map((p) => NAME[p]).join(", ")}.` : "Orphaned — no port's best chain includes it."}</p>
            <Section title="Proof of work">
              <p className="text-[15px] text-ink-2">The header hash must be a number at or below the target. Lower = more leading zeros = more hashes needed to find.</p>
              <Hex label="Hash" value={block.hash} highlight />
              <Hex label="Target" value={block.target} />
            </Section>
            <Section title="Header (80 bytes)">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
                <Row k="Version" v={String(block.header.version)} />
                <Row k="Previous" v={<button type="button" className="hash text-left underline decoration-line underline-offset-4 hover:text-brass" onClick={() => onOpen({ kind: "block", hash: block.header.prevHash })}>{block.header.prevHash}</button>} />
                <Row k="Merkle root" v={<span className="hash">{block.header.merkleRoot}</span>} />
                <Row k="Time" v={<span className="mono">{block.header.time}</span>} />
                <Row k="Bits" v={<span className="mono">{block.header.bits}</span>} />
                <Row k="Nonce" v={<span className="mono">{block.header.nonce.toLocaleString("en-US")}</span>} />
              </dl>
            </Section>
            <Section title={`Transactions (${block.txs.length})`}>
              <ul className="space-y-3">
                {block.txs.map((t) => (
                  <li key={t.id} className="border border-line p-3">
                    <TxBody tx={t} onOpen={onOpen} />
                    <button type="button" className="label mt-2 min-h-11 text-brass underline-offset-4 hover:underline" onClick={() => setProofFor(proofFor === t.id ? null : t.id)} aria-expanded={proofFor === t.id}>
                      {proofFor === t.id ? "Hide" : "Show"} Merkle proof
                    </button>
                    {proofFor === t.id && (
                      <ol className="mt-1 space-y-1">
                        {block.proof.find((p) => p.txid === t.id)!.steps.map((s, i) => <li key={i} className="hash text-muted">{i + 1}. hash with {s.side} sibling <span className="text-ink-2">{s.hash.slice(0, 16)}…</span></li>)}
                        <li className="text-[14px] text-ink-2">{block.proof.find((p) => p.txid === t.id)!.steps.length} hashes prove this transaction is in the block — without the other {block.txs.length - 1}.</li>
                      </ol>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
            <Section title="Which ports have it">
              <p className="mono text-[13px] text-ink-2">{block.seenBy.map((p) => CODE[p]).join(" · ") || "none"}</p>
            </Section>
          </>
        )}
        {tx && (
          <>
            <h2 className="display mt-4 text-3xl">{tx.coinbase ? "Coinbase" : "Payment"}</h2>
            <p className="mt-2 text-ink-2">{tx.confirmations ? `${tx.confirmations} confirmation${tx.confirmations === 1 ? "" : "s"} at ${NAME[at]}.` : `Unconfirmed at ${NAME[at]}.`}</p>
            <div className="mt-5 border border-line p-3"><TxBody tx={tx} onOpen={onOpen} /></div>
          </>
        )}
      </div>
    </div>
  );
}

function TxBody({ tx, onOpen }: { tx: TxDetail; onOpen: (w: Inspecting) => void }) {
  return (
    <div className="text-[15px]">
      <button type="button" className="hash text-left text-ink-2 hover:text-brass" onClick={() => onOpen({ kind: "tx", id: tx.id })}>txid {tx.id.slice(0, 24)}…</button>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <p className="label text-muted">Spends</p>
          {tx.coinbase ? <p className="text-ink-2 italic">New coins: {tx.coinbase}</p> : tx.inputs.map((i) => <p key={i.from} className="text-ink-2">{i.owner ?? "?"} <span className="mono text-[13px]">{kaudi(i.amount)}</span></p>)}
        </div>
        <div>
          <p className="label text-muted">Pays</p>
          {tx.outputs.map((o, i) => <p key={i} className="text-ink-2">{o.owner ?? o.to.slice(0, 12) + "…"} <span className="mono text-[13px] text-ink">{kaudi(o.amount)}</span></p>)}
        </div>
      </div>
      {tx.fee !== null && <p className="label mt-2 text-muted">Fee to the miner: {kaudi(tx.fee)} KAUDI</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-7 border-t border-line pt-4"><h3 className="label mb-3 text-brass">{title}</h3>{children}</section>;
}
function Row({ k, v }: { k: string; v: React.ReactNode }) { return <><dt className="label pt-1 text-muted">{k}</dt><dd className="min-w-0">{v}</dd></>; }
function Hex({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const z = value.match(/^0*/)![0].length;
  return (
    <p className="mt-2"><span className="label mr-2 text-muted">{label}</span>
      <span className="hash"><span className={highlight ? "text-coral" : "text-ink"}>{value.slice(0, z)}</span><span className="text-ink-2">{value.slice(z)}</span></span>
    </p>
  );
}
