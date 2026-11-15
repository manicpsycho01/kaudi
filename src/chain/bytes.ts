/** Byte helpers. Every consensus structure is serialised with these, little-endian, so hashes are unambiguous. */
export type Bytes = Uint8Array;

export class Writer {
  private parts: number[] = [];
  u8(n: number) { this.parts.push(n & 0xff); return this; }
  u32(n: number) { for (let i = 0; i < 4; i++) this.parts.push((n >>> (8 * i)) & 0xff); return this; }
  u64(n: bigint) {
    if (n < 0n || n > 0xffffffffffffffffn) throw new RangeError("u64 out of range");
    for (let i = 0n; i < 8n; i++) this.parts.push(Number((n >> (8n * i)) & 0xffn));
    return this;
  }
  /** Bitcoin-style CompactSize. */
  varint(n: number) {
    if (n < 0xfd) return this.u8(n);
    if (n <= 0xffff) return this.u8(0xfd).u8(n).u8(n >> 8);
    return this.u8(0xfe).u32(n);
  }
  bytes(b: Bytes) { for (const x of b) this.parts.push(x); return this; }
  varbytes(b: Bytes) { return this.varint(b.length).bytes(b); }
  done(): Bytes { return Uint8Array.from(this.parts); }
}

export const hex = (b: Bytes) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
export function unhex(s: string): Bytes {
  if (s.length % 2 || /[^0-9a-f]/i.test(s)) throw new Error("bad hex");
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(2 * i, 2 * i + 2), 16);
  return out;
}
export const utf8 = (s: string) => new TextEncoder().encode(s);
export const ZERO32 = new Uint8Array(32);
export const equal = (a: Bytes, b: Bytes) => a.length === b.length && a.every((x, i) => x === b[i]);
