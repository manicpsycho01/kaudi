import type { Block } from "./block";
import type { Reorg } from "./chainstate";
import type { Tx } from "./tx";
import { outpoint, type UtxoSet } from "./utxo";
import { checkTx, type Result } from "./validate";
import { MAX_BLOCK_TXS } from "./params";

/**
 * Pending transactions, in arrival order. A transaction may spend an earlier pending one's outputs,
 * so arrival order is always a valid mining order. First seen wins: no replace-by-fee.
 */
export class Mempool {
  txs: { tx: Tx; fee: bigint; seenAt: number }[] = [];
  private view!: UtxoSet;
  private spent = new Set<string>();

  constructor(base: UtxoSet) { this.reset(base); }
  has(id: string) { return this.txs.some((t) => t.tx.id === id); }
  get size() { return this.txs.length; }

  private reset(base: UtxoSet) { this.view = base.clone(); this.spent = new Set(); }

  add(tx: Tx, height: number, seenAt = 0): Result<bigint> {
    if (this.has(tx.id)) return { ok: true, value: 0n };
    const r = checkTx(tx, this.view, height, this.spent);
    if (!r.ok) return r;
    for (const i of tx.inputs) this.spent.add(outpoint(i.prevTxid, i.vout));
    this.view.applyTx(tx, height);
    this.txs.push({ tx, fee: r.value, seenAt });
    return r;
  }

  /**
   * After the tip moves: put back transactions from orphaned blocks (they're unconfirmed again),
   * drop ones now in the chain, and re-check the rest — some may now conflict and fall out.
   */
  update(tipView: UtxoSet, height: number, reorg: Reorg | null, connected: Block[]): { dropped: { tx: Tx; reason: string }[]; restored: Tx[] } {
    const inChain = new Set(connected.flatMap((b) => b.txs.map((t) => t.id)));
    const restored = reorg ? reorg.disconnected.flatMap((b) => b.txs.slice(1)).filter((t) => !inChain.has(t.id)) : [];
    const candidates = [...restored.map((tx) => ({ tx, fee: 0n, seenAt: 0 })), ...this.txs].filter((t) => !inChain.has(t.tx.id));
    this.txs = [];
    this.reset(tipView);
    const dropped: { tx: Tx; reason: string }[] = [];
    for (const c of candidates) {
      const r = this.add(c.tx, height + 1, c.seenAt);
      if (!r.ok) dropped.push({ tx: c.tx, reason: r.reject.rule });
    }
    return { dropped, restored: restored.filter((t) => this.has(t.id)) };
  }

  /** What a miner puts in its next block. */
  template(): { txs: Tx[]; fees: bigint } {
    const pick = this.txs.slice(0, MAX_BLOCK_TXS - 1);
    return { txs: pick.map((t) => t.tx), fees: pick.reduce((s, t) => s + t.fee, 0n) };
  }
  /** Coins spendable by a wallet including pending change (pending spends removed). */
  get pendingView() { return this.view; }
}
