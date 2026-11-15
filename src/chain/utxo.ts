import { hex, type Bytes } from "./bytes";
import type { Block } from "./block";
import type { Tx } from "./tx";

export type Coin = { txid: string; vout: number; amount: bigint; pkh: Bytes; height: number; coinbase: boolean };
export const outpoint = (txid: string, vout: number) => `${txid}:${vout}`;

/** The set of unspent outputs — the entire "state" of a UTXO chain. Balances are just sums over it. */
export class UtxoSet {
  readonly coins = new Map<string, Coin>();
  get(txid: string, vout: number) { return this.coins.get(outpoint(txid, vout)); }
  clone() { const u = new UtxoSet(); for (const [k, v] of this.coins) u.coins.set(k, v); return u; }
  /** Applies an already-validated transaction. */
  applyTx(tx: Tx, height: number) {
    for (const i of tx.inputs) this.coins.delete(outpoint(i.prevTxid, i.vout));
    tx.outputs.forEach((o, vout) => this.coins.set(outpoint(tx.id, vout), { txid: tx.id, vout, amount: o.amount, pkh: o.pkh, height, coinbase: !!tx.coinbase }));
  }
  applyBlock(b: Block, height: number) { for (const tx of b.txs) this.applyTx(tx, height); }
  byOwner(pkh: Bytes) { const k = hex(pkh); return [...this.coins.values()].filter((c) => hex(c.pkh) === k); }
  balance(pkh: Bytes) { return this.byOwner(pkh).reduce((s, c) => s + c.amount, 0n); }
}
