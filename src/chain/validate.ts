import { hex } from "./bytes";
import { blockWork, meetsTarget, TARGET_BITS, type Block } from "./block";
import { addressMatches, verify } from "./keys";
import { merkleRoot } from "./merkle";
import { blockReward, COINBASE_MATURITY, MAX_BLOCK_TXS, MAX_FUTURE_S, MAX_MONEY } from "./params";
import { sighash, type Tx } from "./tx";
import { outpoint, type UtxoSet } from "./utxo";

/** Every rejection names the rule it broke, so the UI can show a validation trace instead of "invalid". */
export type Reject = { code: string; rule: string; detail: string };
export type Result<T = void> = { ok: true; value: T } | { ok: false; reject: Reject };
const no = (code: string, rule: string, detail: string): { ok: false; reject: Reject } => ({ ok: false, reject: { code, rule, detail } });
const yes = <T,>(value: T): { ok: true; value: T } => ({ ok: true, value });

export const RULES = {
  "tx-no-inputs": "A transaction must spend at least one coin.",
  "tx-no-outputs": "A transaction must create at least one output.",
  "tx-bad-amount": "Every output must be a positive whole number of kani, within the 21 million supply.",
  "tx-duplicate-input": "A transaction may not spend the same coin twice.",
  "tx-missing-coin": "Inputs must spend coins that exist and are still unspent.",
  "tx-immature": `Coinbase coins can only be spent ${COINBASE_MATURITY} blocks after they were mined.`,
  "tx-wrong-owner": "The public key in an input must hash to the address the coin was sent to.",
  "tx-bad-signature": "Each input needs a valid Schnorr signature over the whole transaction.",
  "tx-overspend": "Outputs may not add up to more than the inputs; the difference is the miner's fee.",
  "tx-conflict": "A coin already spent by a pending transaction can't be spent again (first seen wins).",
  "tx-coinbase-loose": "A coinbase can only appear as the first transaction of a block.",
  "block-pow": "The block hash must be at or below the proof-of-work target.",
  "block-bits": "The header must claim the network's target, no easier.",
  "block-time-old": "The timestamp must be later than the median of the previous 11 blocks.",
  "block-time-future": `The timestamp may be at most ${MAX_FUTURE_S} s ahead of the receiving node's clock.`,
  "block-merkle": "The header's Merkle root must match the block's transactions.",
  "block-no-coinbase": "The first transaction must be the coinbase, and only the first.",
  "block-coinbase-height": "The coinbase must state the block's height.",
  "block-duplicate-tx": "A block may not contain the same transaction twice.",
  "block-too-big": `A block may contain at most ${MAX_BLOCK_TXS} transactions.`,
  "block-reward": "The coinbase may pay out at most the block reward plus the fees in the block.",
  "block-tx": "Every transaction in the block must be valid in order.",
  "block-parent-invalid": "A block built on an invalid block is invalid too.",
} as const;
type Code = keyof typeof RULES;
const fail = (code: Code, detail: string) => no(code, RULES[code], detail);

export type Spends = { spent: Set<string> };
const fmt = (k: bigint) => `${(Number(k) / 1e8).toLocaleString("en-US", { maximumFractionDigits: 8 })} KAUDI`;

/**
 * Checks a non-coinbase transaction against a UTXO view at `height` (the height it would be mined at).
 * `spent` holds outpoints already consumed earlier in the same block / mempool. Returns the fee.
 */
export function checkTx(tx: Tx, view: UtxoSet, height: number, spent: Set<string> = new Set()): Result<bigint> {
  if (tx.coinbase) return fail("tx-coinbase-loose", "This is a coinbase transaction outside the first slot of a block.");
  if (!tx.inputs.length) return fail("tx-no-inputs", "No inputs.");
  if (!tx.outputs.length) return fail("tx-no-outputs", "No outputs.");
  let out = 0n;
  for (const [i, o] of tx.outputs.entries()) {
    if (o.amount <= 0n || o.amount > MAX_MONEY) return fail("tx-bad-amount", `Output ${i} is ${o.amount} kani.`);
    out += o.amount;
  }
  if (out > MAX_MONEY) return fail("tx-bad-amount", "Outputs add up to more than 21 million KAUDI.");
  const seen = new Set<string>();
  let inp = 0n;
  for (const [i, input] of tx.inputs.entries()) {
    const op = outpoint(input.prevTxid, input.vout);
    if (seen.has(op)) return fail("tx-duplicate-input", `Input ${i} repeats ${short(input.prevTxid)}:${input.vout}.`);
    seen.add(op);
    if (spent.has(op)) return fail("tx-conflict", `Coin ${short(input.prevTxid)}:${input.vout} is already being spent by another transaction.`);
    const coin = view.get(input.prevTxid, input.vout);
    if (!coin) return fail("tx-missing-coin", `Coin ${short(input.prevTxid)}:${input.vout} doesn't exist or was already spent.`);
    if (coin.coinbase && coin.height > 0 && height - coin.height < COINBASE_MATURITY)
      return fail("tx-immature", `Input ${i} spends a coinbase from block #${coin.height}; spendable from block #${coin.height + COINBASE_MATURITY}.`);
    if (!addressMatches(input.pubkey, coin.pkh)) return fail("tx-wrong-owner", `Input ${i}'s public key doesn't match the coin's address — it isn't the signer's coin.`);
    if (!verify(input.sig, sighash(tx, i), input.pubkey)) return fail("tx-bad-signature", `Input ${i}'s signature doesn't verify against this exact transaction.`);
    inp += coin.amount;
  }
  if (out > inp) return fail("tx-overspend", `Spends ${fmt(inp)} but pays out ${fmt(out)}.`);
  return yes(inp - out);
}
const short = (h: string) => h.slice(0, 8) + "…";

export type BlockContext = { parentHeight: number; parentTimes: number[]; view: UtxoSet; now: number };

/** Full check of a block on top of its parent. On success returns the UTXO set after the block. */
export function checkBlock(b: Block, ctx: BlockContext): Result<UtxoSet> {
  const h = b.header, height = ctx.parentHeight + 1;
  if (h.bits !== TARGET_BITS) return fail("block-bits", `Header claims bits ${h.bits.toString(16)}, the network requires ${TARGET_BITS.toString(16)}.`);
  if (!meetsTarget(b.hash, h.bits)) return fail("block-pow", `Hash ${b.hash.slice(0, 16)}… is above the target — no proof of work was done.`);
  const times = [...ctx.parentTimes].slice(-11).sort((a, c) => a - c);
  const mtp = times.length ? times[Math.floor(times.length / 2)]! : 0;
  if (h.time <= mtp) return fail("block-time-old", `Time ${h.time} is not after the median ${mtp}.`);
  if (h.time > ctx.now + MAX_FUTURE_S) return fail("block-time-future", `Time is ${h.time - ctx.now} s ahead of this node's clock.`);
  if (!b.txs.length || !b.txs[0]!.coinbase || b.txs.slice(1).some((t) => t.coinbase)) return fail("block-no-coinbase", "The coinbase is missing or not first.");
  if (b.txs.length > MAX_BLOCK_TXS) return fail("block-too-big", `${b.txs.length} transactions.`);
  const ids = b.txs.map((t) => t.id);
  if (new Set(ids).size !== ids.length) return fail("block-duplicate-tx", "A transaction appears twice.");
  if (merkleRoot(ids) !== h.merkleRoot) return fail("block-merkle", "The transactions don't hash to the header's Merkle root — they were changed after mining.");
  const cb = b.txs[0]!;
  if (cb.coinbase!.height !== height) return fail("block-coinbase-height", `Coinbase says #${cb.coinbase!.height}, block is #${height}.`);

  const view = ctx.view.clone();
  const spent = new Set<string>();
  let fees = 0n;
  for (const [i, tx] of b.txs.slice(1).entries()) {
    const r = checkTx(tx, view, height, spent);
    if (!r.ok) return no("block-tx", RULES["block-tx"], `Transaction ${i + 1} (${short(tx.id)}): ${r.reject.rule} ${r.reject.detail}`);
    fees += r.value;
    for (const inp of tx.inputs) spent.add(outpoint(inp.prevTxid, inp.vout));
    view.applyTx(tx, height);
  }
  let paid = 0n;
  for (const o of cb.outputs) {
    if (o.amount <= 0n || o.amount > MAX_MONEY) return fail("tx-bad-amount", "Coinbase output out of range.");
    paid += o.amount;
  }
  const allowed = blockReward(height) + fees;
  if (paid > allowed) return fail("block-reward", `Coinbase pays ${fmt(paid)}; allowed ${fmt(allowed)} (reward ${fmt(blockReward(height))} + fees ${fmt(fees)}).`);
  view.applyTx(cb, height);
  return yes(view);
}

export { blockWork, hex };
