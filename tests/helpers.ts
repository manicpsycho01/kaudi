import { assemble, TARGET_BITS, meetsTarget, type Block } from "@/chain/block";
import type { ChainState } from "@/chain/chainstate";
import { makeCoinbase, type Tx, type TxOut } from "@/chain/tx";
import { blockReward } from "@/chain/params";
import type { Bytes } from "@/chain/bytes";

/** Mines a valid block on `parent` (real proof of work at the network target). */
export function mine(chain: ChainState, parentHash: string, txs: Tx[], opts: { pay?: Bytes; extra?: bigint; time?: number; fees?: bigint; tag?: number; coinbaseOutputs?: TxOut[] } = {}): Block {
  const parent = chain.entries.get(parentHash)!;
  const height = parent.height + 1;
  const pay = opts.pay ?? new Uint8Array(20).fill(7);
  const amount = blockReward(height) + (opts.fees ?? 0n) + (opts.extra ?? 0n);
  const cb = makeCoinbase(height, opts.coinbaseOutputs ?? [{ amount, pkh: pay }], "", opts.tag ?? 0);
  const time = opts.time ?? parent.block.header.time + 8;
  for (let nonce = 0; ; nonce++) {
    const b = assemble({ version: 1, prevHash: parentHash, time, bits: TARGET_BITS, nonce }, [cb, ...txs]);
    if (meetsTarget(b.hash, TARGET_BITS)) return b;
  }
}
export const NOW = 1_794_700_800 + 10_000;
