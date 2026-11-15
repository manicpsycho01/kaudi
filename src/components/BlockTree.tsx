"use client";
import { useEffect, useMemo, useRef } from "react";
import type { Snap, TreeBlock } from "@/sim/snapshot";
import { CODE, minerCode, minerName } from "./ports";

const W = 92, H = 64, GX = 26, GY = 22, TAGS = 34;

/** Lays blocks out by height (x) and branch (y): a block takes its parent's row unless a sibling with more support already did. */
export function layout(blocks: TreeBlock[]) {
  const byHash = new Map(blocks.map((b) => [b.hash, b]));
  const kids = new Map<string, TreeBlock[]>();
  for (const b of blocks) kids.set(b.parent, [...(kids.get(b.parent) ?? []), b]);
  const row = new Map<string, number>();
  let next = 0;
  const support = (b: TreeBlock): number => b.mainOf.length * 1000 + Math.max(0, ...(kids.get(b.hash) ?? []).map(support));
  const roots = blocks.filter((b) => !byHash.has(b.parent)).sort((a, b) => support(b) - support(a));
  const place = (b: TreeBlock, r: number) => {
    row.set(b.hash, r);
    const children = (kids.get(b.hash) ?? []).sort((x, y) => support(y) - support(x) || x.foundAt - y.foundAt);
    children.forEach((c, i) => place(c, i === 0 ? r : ++next));
  };
  for (const [i, r] of roots.entries()) place(r, i === 0 ? 0 : ++next);
  const minH = blocks.length ? Math.min(...blocks.map((b) => b.height)) : 0;
  return { row, minH, rows: next + 1 };
}

export function BlockTree({ snap, onSelect, selected, className = "" }: { snap: Snap | null; onSelect?: (hash: string) => void; selected?: string | null; className?: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const blocks = useMemo(() => snap?.tree ?? [], [snap]);
  const { row, minH, rows } = useMemo(() => layout(blocks), [blocks]);
  const maxH = Math.max(0, ...blocks.map((b) => b.height));
  const online = (snap?.nodes ?? []).filter((n) => n.online).length || 8;
  const width = (maxH - minH + 1) * (W + GX) + GX, height = rows * (H + GY + TAGS) + GY;
  const pos = (b: TreeBlock) => ({ x: GX + (b.height - minH) * (W + GX), y: GY + row.get(b.hash)! * (H + GY + TAGS) });

  // Keep the newest blocks in view unless the reader has scrolled back.
  const stick = useRef(true);
  useEffect(() => { const el = scroller.current; if (el && stick.current) el.scrollLeft = el.scrollWidth; }, [width]);

  return (
    <div ref={scroller} className={`overflow-x-auto overscroll-x-contain ${className}`} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8; }}
      role="region" aria-label="Block tree: every branch any port has seen" tabIndex={0}>
      <div className="relative" style={{ width, height: Math.max(height, H + 2 * GY + TAGS) }}>
        <svg className="pointer-events-none absolute inset-0" width={width} height={height} aria-hidden>
          {blocks.map((b) => {
            const p = blocks.find((x) => x.hash === b.parent);
            if (!p) return null;
            const a = pos(p), c = pos(b);
            const x1 = a.x + W, y1 = a.y + H / 2, x2 = c.x, y2 = c.y + H / 2;
            return <path key={b.hash} d={`M${x1} ${y1} C${x1 + GX / 2} ${y1} ${x2 - GX / 2} ${y2} ${x2} ${y2}`} fill="none" stroke="var(--color-ink)" strokeOpacity={b.mainOf.length ? 0.45 : 0.18} strokeWidth="1.2" />;
          })}
        </svg>
        {blocks.map((b, i) => {
          const { x, y } = pos(b);
          const orphan = !b.mainOf.length;
          const fresh = snap ? snap.t - b.foundAt < 2500 : false;
          const zeros = b.hash.match(/^0*/)![0].length;
          return (
            <button key={b.hash} type="button" onClick={() => onSelect?.(b.hash)} data-block={b.hash} data-orphan={orphan || undefined}
              aria-label={`Block ${b.height}, mined by ${minerName(b.miner)}, ${b.txs} transaction${b.txs === 1 ? "" : "s"}${orphan ? ", orphaned" : ""}${b.secret ? ", secret" : ""}`}
              className={`absolute flex flex-col justify-between border px-2 py-1.5 text-left transition-colors hover:border-brass ${selected === b.hash ? "border-brass bg-sea-3" : orphan ? "border-line-2 bg-sea" : "border-line bg-sea-2"} ${b.secret ? "border-dashed !border-coral" : ""}`}
              style={{ left: x, top: y, width: W, height: H, opacity: orphan ? 0.55 : 1, animation: fresh && i === blocks.length - 1 ? "flash 2.2s ease-out" : undefined }}>
              <span className="flex items-baseline justify-between">
                <span className="mono text-[13px] text-ink">#{b.height}</span>
                <span className="label !text-[10.5px] text-brass">{minerCode(b.miner)}</span>
              </span>
              <span className="mono truncate text-[11px] text-muted"><span className="text-ink-2">{b.hash.slice(0, zeros)}</span>{b.hash.slice(zeros, zeros + 5)}</span>
              <span className="label truncate !text-[10.5px] text-muted">{b.txs} tx{orphan ? " · orphan" : b.secret ? " · secret" : ""}</span>
            </button>
          );
        })}
        {blocks.map((b) => {
          if (!b.tipOf.length) return null;
          const { x, y } = pos(b);
          return (
            <div key={"t" + b.hash} className="absolute flex max-h-[32px] flex-wrap gap-0.5 overflow-hidden" style={{ left: x, top: y + H + 3, width: W + GX - 4 }} aria-hidden>
              {b.tipOf.length >= online ? <span className="label !text-[10.5px] bg-kelp-soft px-1 text-kelp">All ports</span>
                : b.tipOf.map((p) => <span key={p} className="label !text-[10.5px] bg-ink/10 px-1 text-ink-2">{CODE[p]}</span>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
