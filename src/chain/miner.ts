import { assemble, serializeHeader, TARGET, TARGET_BITS, type Block, type Header } from "./block";
import { hashNum, sha256d } from "./hash";
import { merkleRoot } from "./merkle";
import type { Tx } from "./tx";

/**
 * Searches nonces for a header in small slices so the page stays responsive, reporting attempts as it goes.
 * Real work at the real target: on average 32,000 tries.
 */
export async function mineAsync(h: Omit<Header, "nonce" | "merkleRoot" | "bits">, txs: Tx[], onProgress?: (tries: number, hash: string) => void, signal?: AbortSignal): Promise<{ block: Block; tries: number }> {
  const header: Header = { ...h, bits: TARGET_BITS, merkleRoot: merkleRoot(txs.map((t) => t.id)), nonce: 0 };
  const buf = serializeHeader(header);
  let nonce = 0;
  for (;;) {
    if (signal?.aborted) throw new DOMException("aborted", "AbortError");
    const end = nonce + 2500;
    let last = buf;
    for (; nonce < end; nonce++) {
      buf[76] = nonce & 255; buf[77] = (nonce >>> 8) & 255; buf[78] = (nonce >>> 16) & 255; buf[79] = (nonce >>> 24) & 255;
      const d = sha256d(buf);
      if (hashNum(d) <= TARGET) {
        const block = assemble({ version: 1, prevHash: h.prevHash, time: h.time, bits: TARGET_BITS, nonce }, txs);
        onProgress?.(nonce + 1, block.hash);
        return { block, tries: nonce + 1 };
      }
      last = d;
    }
    onProgress?.(nonce, Array.from(last, (x) => x.toString(16).padStart(2, "0")).join(""));
    await new Promise((r) => setTimeout(r, 0));
  }
}
