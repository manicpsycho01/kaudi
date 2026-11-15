import { hex, unhex, Writer, type Bytes } from "./bytes";
import { hashNum, sha256d } from "./hash";
import { merkleRoot } from "./merkle";
import { BLOCK_REWARD, EXPECTED_ATTEMPTS } from "./params";
import { makeCoinbase, type Tx } from "./tx";

export type Header = { version: 1; prevHash: string; merkleRoot: string; time: number; bits: number; nonce: number };
export type Block = { header: Header; txs: Tx[]; hash: string };

/** 80 bytes, exactly like Bitcoin's header layout. */
export const serializeHeader = (h: Header) =>
  new Writer().u32(h.version).bytes(unhex(h.prevHash)).bytes(unhex(h.merkleRoot)).u32(h.time).u32(h.bits).u32(h.nonce).done();
export const headerHash = (h: Header) => hex(sha256d(serializeHeader(h)));

/** Bitcoin's compact "bits" encoding of the target: 1 byte exponent, 3 byte mantissa. */
export function targetToBits(target: bigint): number {
  let size = Math.ceil(target.toString(16).length / 2);
  let mant = size <= 3 ? Number(target << BigInt(8 * (3 - size))) : Number(target >> BigInt(8 * (size - 3)));
  if (mant & 0x800000) { mant >>= 8; size++; } // keep the sign bit clear
  return ((size << 24) | mant) >>> 0;
}
export function bitsToTarget(bits: number): bigint {
  const size = bits >>> 24, mant = BigInt(bits & 0x7fffff);
  return size <= 3 ? mant >> BigInt(8 * (3 - size)) : mant << BigInt(8 * (size - 3));
}
const MAX = 1n << 256n;
export const TARGET_BITS = targetToBits(MAX / BigInt(EXPECTED_ATTEMPTS));
export const TARGET = bitsToTarget(TARGET_BITS);
/** Expected hashes to find a block at this target — what "most work" adds up. */
export const blockWork = (bits: number) => MAX / (bitsToTarget(bits) + 1n);
export const meetsTarget = (hash: string, bits: number) => hashNum(unhex(hash)) <= bitsToTarget(bits);

export function assemble(header: Omit<Header, "merkleRoot">, txs: Tx[]): Block {
  const h: Header = { ...header, merkleRoot: merkleRoot(txs.map((t) => t.id)) };
  return { header: h, txs, hash: headerHash(h) };
}

/**
 * Genesis: hard-coded, like Bitcoin's. Unlike Bitcoin's, its coinbase is spendable and funds the demo
 * treasuries, so there is something to send from the first second. Its nonce was found once and pinned (see tests).
 */
export const GENESIS_MESSAGE = "15/Nov/2026 Not worth a phooti kaudi? Let's see.";
export const GENESIS_TIME = 1_794_700_800; // 2026-11-15T00:00:00Z
export const GENESIS_NONCE = 839;
export function makeGenesis(alloc: { pkh: Bytes; amount: bigint }[]): Block {
  const cb = makeCoinbase(0, alloc.length ? alloc.map((a) => ({ amount: a.amount, pkh: a.pkh })) : [{ amount: BLOCK_REWARD, pkh: new Uint8Array(20) }], GENESIS_MESSAGE);
  return assemble({ version: 1, prevHash: "00".repeat(32), time: GENESIS_TIME, bits: TARGET_BITS, nonce: GENESIS_NONCE }, [cb]);
}
