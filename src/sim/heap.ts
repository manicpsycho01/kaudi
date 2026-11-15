/** Min-heap ordered by (time, seq): events at the same instant run in the order they were scheduled. */
export class EventQueue<T extends { t: number; seq: number }> {
  private a: T[] = [];
  get size() { return this.a.length; }
  peek() { return this.a[0]; }
  push(x: T) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (less(a[p]!, a[i]!)) break; [a[p], a[i]] = [a[i]!, a[p]!]; i = p; } }
  pop(): T | undefined {
    const a = this.a; if (!a.length) return undefined;
    const top = a[0]!, last = a.pop()!;
    if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && less(a[l]!, a[m]!)) m = l; if (r < a.length && less(a[r]!, a[m]!)) m = r; if (m === i) break; [a[m], a[i]] = [a[i]!, a[m]!]; i = m; } }
    return top;
  }
  items() { return this.a; }
}
const less = (x: { t: number; seq: number }, y: { t: number; seq: number }) => x.t < y.t || (x.t === y.t && x.seq < y.seq);
