import { concatBytes } from "@noble/hashes/utils.js";
import { hex, unhex, type Bytes } from "./bytes";
import { sha256d } from "./hash";

/**
 * Bitcoin's Merkle tree: hash pairs upward, duplicating the last hash on odd levels.
 * (Duplication allows two different tx lists with one root — CVE-2012-2459 — so blocks with duplicate txids are rejected.)
 */
export function merkleLevels(txids: string[]): Bytes[][] {
  if (!txids.length) return [[new Uint8Array(32)]];
  const levels: Bytes[][] = [txids.map(unhex)];
  while (levels.at(-1)!.length > 1) {
    const cur = levels.at(-1)!;
    const next: Bytes[] = [];
    for (let i = 0; i < cur.length; i += 2) next.push(sha256d(concatBytes(cur[i]!, cur[i + 1] ?? cur[i]!)));
    levels.push(next);
  }
  return levels;
}
export const merkleRoot = (txids: string[]) => hex(merkleLevels(txids).at(-1)![0]!);

export type ProofStep = { hash: string; side: "left" | "right" };
/** The sibling hashes needed to climb from one transaction to the root — log2(n) hashes instead of the whole block. */
export function merkleProof(txids: string[], index: number): ProofStep[] {
  const levels = merkleLevels(txids);
  const steps: ProofStep[] = [];
  for (let l = 0; l < levels.length - 1; l++) {
    const level = levels[l]!;
    const sib = index ^ 1;
    steps.push({ hash: hex(level[sib] ?? level[index]!), side: index % 2 ? "left" : "right" });
    index >>= 1;
  }
  return steps;
}
export function verifyProof(txid: string, proof: ProofStep[], root: string): boolean {
  let h = unhex(txid);
  for (const s of proof) h = sha256d(s.side === "left" ? concatBytes(unhex(s.hash), h) : concatBytes(h, unhex(s.hash)));
  return hex(h) === root;
}
