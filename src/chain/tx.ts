import { hex, utf8, Writer, ZERO32, type Bytes } from "./bytes";
import { sha256d } from "./hash";
import { sign, type Keypair } from "./keys";

/** Spends one earlier output, proving ownership with a BIP340 Schnorr signature. */
export type TxIn = { prevTxid: string; vout: number; pubkey: Bytes; sig: Bytes };
/** Pays `amount` kani to whoever can sign for hash160(pubkey) == pkh. */
export type TxOut = { amount: bigint; pkh: Bytes };
/** Coinbase: no real input — it carries the block height (so every coinbase is unique) and a free-text message. */
export type Coinbase = { height: number; extranonce: number; message: string };
export type Tx = { version: 1; coinbase?: Coinbase; inputs: TxIn[]; outputs: TxOut[]; id: string };

const COINBASE_VOUT = 0xffffffff;

function write(tx: Omit<Tx, "id">, blankSigs: boolean, w = new Writer()) {
  w.u32(tx.version);
  if (tx.coinbase) {
    const cb = tx.coinbase;
    w.varint(1).bytes(ZERO32).u32(COINBASE_VOUT).varbytes(new Writer().u32(cb.height).u32(cb.extranonce).varbytes(utf8(cb.message)).done());
  } else {
    w.varint(tx.inputs.length);
    for (const i of tx.inputs) w.bytes(fromHex32(i.prevTxid)).u32(i.vout).bytes(i.pubkey).bytes(blankSigs ? new Uint8Array(64) : i.sig);
  }
  w.varint(tx.outputs.length);
  for (const o of tx.outputs) w.u64(o.amount).bytes(o.pkh);
  return w;
}
const fromHex32 = (s: string) => Uint8Array.from(s.match(/../g)!.map((x) => parseInt(x, 16)));

export const serializeTx = (tx: Omit<Tx, "id">) => write(tx, false).done();
export const txid = (tx: Omit<Tx, "id">) => hex(sha256d(serializeTx(tx)));
/**
 * What input `index` signs: the whole transaction with every signature blanked (so a signature never signs itself),
 * plus the input's index. Changing any amount, address or input invalidates every signature (SIGHASH_ALL).
 */
export const sighash = (tx: Omit<Tx, "id">, index: number) => sha256d(write(tx, true).u32(index).done());

export const finalize = (tx: Omit<Tx, "id">): Tx => ({ ...tx, id: txid(tx) });

export function makeCoinbase(height: number, outputs: TxOut[], message = "", extranonce = 0): Tx {
  return finalize({ version: 1, coinbase: { height, extranonce, message }, inputs: [], outputs });
}

/** Builds and signs a spend. `inputs` must all belong to `key`. */
export function makeSpend(key: Keypair, inputs: { txid: string; vout: number }[], outputs: TxOut[]): Tx {
  const unsigned = { version: 1 as const, inputs: inputs.map((i) => ({ prevTxid: i.txid, vout: i.vout, pubkey: key.pubkey, sig: new Uint8Array(64) })), outputs };
  const signed = { ...unsigned, inputs: unsigned.inputs.map((inp, idx) => ({ ...inp, sig: sign(sighash(unsigned, idx), key.secret) })) };
  return finalize(signed);
}

export const isCoinbase = (tx: Tx) => !!tx.coinbase;
export const outputTotal = (tx: Tx) => tx.outputs.reduce((s, o) => s + o.amount, 0n);
