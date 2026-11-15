import { schnorr } from "@noble/curves/secp256k1.js";
import { bech32m } from "@scure/base";
import { equal, hex, type Bytes } from "./bytes";
import { hash160, sha256 } from "./hash";

export const ADDRESS_PREFIX = "kd";

export type Keypair = { secret: Bytes; pubkey: Bytes; pkh: Bytes; address: string };

/** Turns a 32-byte secret into a keypair. pubkey is the BIP340 x-only key; the address commits to hash160(pubkey). */
export function keypair(secret: Bytes): Keypair {
  const pubkey = schnorr.getPublicKey(secret);
  const pkh = hash160(pubkey);
  return { secret, pubkey, pkh, address: encodeAddress(pkh) };
}
/** Deterministic keys for named demo wallets and seeded runs. */
export const keypairFromSeed = (seed: string) => keypair(validSecret(sha256(new TextEncoder().encode("kaudi/key/" + seed))));

function validSecret(b: Bytes): Bytes {
  // A secret must be in [1, n-1]; a sha256 output is outside that range with probability ~2^-128, so re-hash in that case.
  try { schnorr.getPublicKey(b); return b; } catch { return validSecret(sha256(b)); }
}

export const encodeAddress = (pkh: Bytes) => bech32m.encode(ADDRESS_PREFIX, bech32m.toWords(pkh));
export function decodeAddress(address: string): Bytes | null {
  try {
    const { prefix, words } = bech32m.decode(address as `${string}1${string}`);
    if (prefix !== ADDRESS_PREFIX) return null;
    const pkh = bech32m.fromWords(words);
    return pkh.length === 20 ? Uint8Array.from(pkh) : null;
  } catch { return null; }
}
export const addressMatches = (pubkey: Bytes, pkh: Bytes) => equal(hash160(pubkey), pkh);

export const sign = (msg32: Bytes, secret: Bytes, aux: Bytes = new Uint8Array(32)) => schnorr.sign(msg32, secret, aux);

/** Signature checks are pure, so results are cached (Bitcoin does the same) — replaying a chain after a reorg stays cheap. */
const cache = new Map<string, boolean>();
export function verify(sig: Bytes, msg32: Bytes, pubkey: Bytes): boolean {
  const k = hex(sig) + hex(msg32) + hex(pubkey);
  let ok = cache.get(k);
  if (ok === undefined) {
    try { ok = schnorr.verify(sig, msg32, pubkey); } catch { ok = false; }
    if (cache.size > 50_000) cache.clear();
    cache.set(k, ok);
  }
  return ok;
}
