import { ripemd160 } from "@noble/hashes/legacy.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex, type Bytes } from "./bytes";

export const sha256d = (b: Bytes) => sha256(sha256(b));
export const hash160 = (b: Bytes) => ripemd160(sha256(b));
/** Hashes are read as big-endian 256-bit numbers (unlike Bitcoin, which reverses them) — what you see is what is compared. */
export const hashNum = (h: Bytes) => BigInt("0x" + hex(h));
export { sha256 };
