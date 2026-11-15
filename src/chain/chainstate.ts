import { blockWork, type Block } from "./block";
import { checkBlock, type Reject } from "./validate";
import { UtxoSet } from "./utxo";

export type Entry = { block: Block; height: number; work: bigint; parent: string | null; status: "valid" | "invalid"; reject?: Reject; seenAt: number };
export type AcceptResult =
  | { kind: "known" }
  | { kind: "orphan"; missing: string }
  | { kind: "invalid"; reject: Reject }
  | { kind: "accepted"; reorg: Reorg | null; newTip: boolean };
/** A switch of best chain: blocks taken off (orphaned) and put on, oldest first. */
export type Reorg = { disconnected: Block[]; connected: Block[]; forkPoint: string };

/**
 * One node's view of the chain: a tree of every block it has seen, and a best tip chosen by
 * most cumulative proof of work (not most blocks). Ties keep whichever tip arrived first.
 */
export class ChainState {
  readonly entries = new Map<string, Entry>();
  /** Blocks whose parent we haven't seen yet, keyed by the missing parent. */
  readonly orphans = new Map<string, Block[]>();
  tip: string;
  private tipView: UtxoSet;

  constructor(readonly genesis: Block) {
    const view = new UtxoSet();
    view.applyBlock(genesis, 0);
    this.entries.set(genesis.hash, { block: genesis, height: 0, work: blockWork(genesis.header.bits), parent: null, status: "valid", seenAt: 0 });
    this.tip = genesis.hash;
    this.tipView = view;
  }

  get tipEntry() { return this.entries.get(this.tip)!; }
  get height() { return this.tipEntry.height; }
  /** UTXO set at the tip. Treat as read-only. */
  get view() { return this.tipView; }
  has(hash: string) { return this.entries.has(hash) || [...this.orphans.values()].some((bs) => bs.some((b) => b.hash === hash)); }

  /** Hashes from genesis to `hash`. */
  path(hash: string): string[] {
    const out: string[] = [];
    for (let h: string | null = hash; h; h = this.entries.get(h)!.parent) out.push(h);
    return out.reverse();
  }
  mainChain() { return this.path(this.tip); }
  isOnMain(hash: string) {
    const e = this.entries.get(hash);
    if (!e) return false;
    const p = this.path(this.tip);
    return p[e.height] === hash;
  }

  /** Rebuilds the UTXO set at any block by replaying from genesis (chains here are short; signature checks are cached). */
  viewAt(hash: string): UtxoSet {
    if (hash === this.tip) return this.tipView;
    const u = new UtxoSet();
    for (const h of this.path(hash)) { const e = this.entries.get(h)!; u.applyBlock(e.block, e.height); }
    return u;
  }
  private times(hash: string) { return this.path(hash).slice(-11).map((h) => this.entries.get(h)!.block.header.time); }

  accept(block: Block, now: number, nowMs = now * 1000): AcceptResult[] {
    if (this.entries.has(block.hash)) return [{ kind: "known" }];
    const parent = this.entries.get(block.header.prevHash);
    if (!parent) {
      const list = this.orphans.get(block.header.prevHash) ?? [];
      if (!list.some((b) => b.hash === block.hash)) list.push(block);
      this.orphans.set(block.header.prevHash, list);
      return [{ kind: "orphan", missing: block.header.prevHash }];
    }
    const results: AcceptResult[] = [this.connect(block, parent, now, nowMs)];
    // Any orphans waiting on this block can now be connected.
    const waiting = this.orphans.get(block.hash);
    if (waiting) {
      this.orphans.delete(block.hash);
      for (const o of waiting) results.push(...this.accept(o, now, nowMs));
    }
    return results;
  }

  private connect(block: Block, parent: Entry, now: number, nowMs: number): AcceptResult {
    const base = { block, height: parent.height + 1, work: parent.work + blockWork(block.header.bits), parent: parent.block.hash, seenAt: nowMs };
    if (parent.status === "invalid") {
      const reject = { code: "block-parent-invalid", rule: "A block built on an invalid block is invalid too.", detail: `Parent ${parent.block.hash.slice(0, 12)}… was rejected.` };
      this.entries.set(block.hash, { ...base, status: "invalid", reject });
      return { kind: "invalid", reject };
    }
    const r = checkBlock(block, { parentHeight: parent.height, parentTimes: this.times(parent.block.hash), view: this.viewAt(parent.block.hash), now });
    if (!r.ok) {
      this.entries.set(block.hash, { ...base, status: "invalid", reject: r.reject });
      return { kind: "invalid", reject: r.reject };
    }
    this.entries.set(block.hash, { ...base, status: "valid" });
    if (base.work <= this.tipEntry.work) return { kind: "accepted", reorg: null, newTip: false };
    const reorg = parent.block.hash === this.tip ? null : this.reorgTo(block.hash);
    this.tip = block.hash;
    this.tipView = r.value;
    return { kind: "accepted", reorg, newTip: true };
  }

  private reorgTo(newTip: string): Reorg {
    const oldPath = this.path(this.tip), newPath = this.path(newTip);
    let i = 0;
    while (i < oldPath.length && i < newPath.length && oldPath[i] === newPath[i]) i++;
    const get = (h: string) => this.entries.get(h)!.block;
    return { forkPoint: newPath[i - 1]!, disconnected: oldPath.slice(i).map(get), connected: newPath.slice(i).map(get) };
  }

  /** Confirmations of a transaction on the best chain (0 = not in it). */
  confirmations(txid: string): number {
    const path = this.mainChain();
    for (let i = path.length - 1; i >= 0; i--) if (this.entries.get(path[i]!)!.block.txs.some((t) => t.id === txid)) return path.length - i;
    return 0;
  }
}
