"use client";
import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { CHART, GRATICULE, LAND, PORT_XY } from "@/sim/coast";
import type { Snap } from "@/sim/snapshot";
import type { PortId } from "@/sim/world";
import { CODE, LABEL } from "./ports";

type Received = MutableRefObject<{ at: number; t: number; speed: number; paused: boolean }>;
const xy = (id: string) => PORT_XY[id]!;

/**
 * The live chart. Ports are nodes; lanes are network links; every message in flight is a boat that
 * sails the lane in simulated time — so you can see a block reach one port before another.
 */
export function Chart({ snap, received, selected, onPort, onRoute, className = "", focus }: {
  snap: Snap | null; received: Received; selected?: PortId | null; onPort?: (id: PortId) => void; onRoute?: (a: PortId, b: PortId, cut: boolean) => void; className?: string; focus?: PortId[];
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const boatsRef = useRef<SVGGElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / CHART.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sail the boats between snapshots.
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      const g = boatsRef.current, r = received.current;
      if (g) {
        const t = r.t + (r.paused ? 0 : (performance.now() - r.at) * r.speed);
        for (const el of Array.from(g.children) as SVGGElement[]) {
          const [x1, y1] = xy(el.dataset.from!), [x2, y2] = xy(el.dataset.to!);
          const sent = +el.dataset.sent!, arrive = +el.dataset.arrive!;
          const k = Math.min(1, Math.max(0, (t - sent) / Math.max(1, arrive - sent)));
          el.setAttribute("transform", `translate(${x1 + (x2 - x1) * k} ${y1 + (y2 - y1) * k}) rotate(${(Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI})`);
          el.style.opacity = k >= 1 ? "0" : "1";
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [received]);

  const s = 1 / Math.max(scale, 0.3); // keeps text and marks a constant size on screen
  const small = scale < 0.62;
  const font = 13 * s, mono = 11 * s;
  const now = snap?.t ?? 0;
  const recent = (snap?.tree ?? []).filter((b) => now - b.foundAt < 1600 && b.miner in PORT_XY);
  const dim = (id: string) => (focus && !focus.includes(id as PortId) ? 0.35 : 1);

  return (
    <div ref={wrap} className={`relative ${className}`}>
      <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} className="block h-auto w-full" role="img" aria-label="Chart of the Indian Ocean network: ports joined by sea lanes, with messages in flight">
        <defs>
          <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <line x1="0" y1="0" x2="0" y2="7" stroke="var(--color-ink)" strokeOpacity=".05" strokeWidth="1.2" />
          </pattern>
          <pattern id="rain" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-20)">
            <line x1="0" y1="0" x2="0" y2="10" stroke="var(--color-coral)" strokeOpacity=".35" strokeWidth="1.2" />
          </pattern>
          <radialGradient id="glow"><stop offset="0" stopColor="var(--color-brass)" stopOpacity=".18" /><stop offset="1" stopColor="var(--color-brass)" stopOpacity="0" /></radialGradient>
        </defs>
        <path d={GRATICULE} fill="none" stroke="var(--color-ink)" strokeOpacity=".06" strokeWidth={0.8 * s} />
        <line x1="0" x2={CHART.width} y1={CHART.equatorY} y2={CHART.equatorY} stroke="var(--color-brass)" strokeOpacity=".35" strokeDasharray={`${6 * s} ${5 * s}`} strokeWidth={s} />
        {!small && <text x={CHART.width - 10} y={CHART.equatorY - 7} textAnchor="end" fill="var(--color-brass)" fillOpacity=".7" fontSize={mono} fontFamily="var(--font-mono)" letterSpacing=".15em">EQUATOR</text>}
        <path d={LAND} fill="var(--color-land)" />
        <path d={LAND} fill="url(#hatch)" stroke="var(--color-ink)" strokeOpacity=".28" strokeWidth={0.7 * s} />

        {snap?.monsoon && (
          <g aria-label="Monsoon: the sea is split between west and east">
            <path d="M 400 0 C 360 160 440 300 420 420 S 330 560 360 640 L 470 640 C 440 560 520 440 500 320 S 470 120 500 0 Z" fill="url(#rain)" />
            <text x="452" y="60" textAnchor="middle" fill="var(--color-coral)" fontSize={font * 1.05} fontFamily="var(--font-display)" letterSpacing=".2em">MONSOON</text>
          </g>
        )}

        {snap?.links.map((l) => {
          const [x1, y1] = xy(l.a), [x2, y2] = xy(l.b);
          const down = !l.up;
          return (
            <g key={l.a + l.b} opacity={Math.min(dim(l.a), dim(l.b))}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={down ? "var(--color-coral)" : "var(--color-ink)"} strokeOpacity={down ? 0.55 : 0.32} strokeWidth={1.2 * s} strokeDasharray={down ? `${3 * s} ${6 * s}` : `${8 * s} ${5 * s}`} />
              {onRoute && (
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={22 * s} className="cursor-pointer" role="button" tabIndex={-1}
                  aria-label={`${l.cut ? "Reopen" : "Cut"} the lane ${l.a}–${l.b}`} onClick={() => onRoute(l.a, l.b, !l.cut)}>
                  <title>{l.cut ? "Reopen this lane" : "Cut this lane"}</title>
                </line>
              )}
              {l.cut && !snap.monsoon && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 + 5 * s} textAnchor="middle" fill="var(--color-coral)" fontSize={font * 1.3}>×</text>}
            </g>
          );
        })}

        <g ref={boatsRef}>
          {snap?.boats.map((b) => (
            <g key={b.id} data-from={b.from} data-to={b.to} data-sent={b.sent} data-arrive={b.arrive} style={{ opacity: 0 }}>
              {b.kind === "block" || b.kind === "blocks" ? (
                <g transform={`scale(${s})`}>
                  <path d="M-7 3 L7 3 L5 7 L-5 7 Z" fill="var(--color-ink)" />
                  <path d="M-1 2 L-1 -11 L7 0 Z" fill="var(--color-ink)" />
                  {b.kind === "blocks" && <path d="M-3 1 L-3 -8 L-9 0 Z" fill="var(--color-brass)" />}
                </g>
              ) : b.kind === "tx" ? (
                <circle r={3.2 * s} fill="var(--color-amber)" />
              ) : (
                <circle r={3 * s} fill="none" stroke="var(--color-ink)" strokeOpacity=".7" strokeWidth={s} />
              )}
            </g>
          ))}
        </g>

        {recent.map((b) => { const [x, y] = xy(b.miner); return <circle key={b.hash} cx={x} cy={y} r="6" fill="none" stroke="var(--color-coral)" style={{ animation: "ripple 1.4s var(--ease-out-expo) forwards", transformBox: "fill-box" }} transform={`scale(${s})`} transform-origin={`${x} ${y}`} />; })}

        {snap?.nodes.map((n) => {
          const [x, y] = xy(n.id);
          const L = LABEL[n.id];
          const isSel = selected === n.id;
          const armed = n.id !== "socotra" || n.hashrate > 0;
          return (
            <g key={n.id} opacity={n.online ? dim(n.id) : 0.35} className={onPort ? "cursor-pointer" : ""} onClick={() => onPort?.(n.id)}
              role={onPort ? "button" : undefined} tabIndex={onPort ? 0 : undefined} aria-label={onPort ? `${n.name}: block ${n.height}${n.online ? "" : ", offline"}` : undefined}
              onKeyDown={(e) => { if (onPort && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onPort(n.id); } }}>
              <circle cx={x} cy={y} r={34 * s} fill="url(#glow)" opacity={isSel ? 1 : 0} />
              <circle cx={x} cy={y} r={7 * s} fill={n.withhold ? "var(--color-coral)" : armed ? "var(--color-ink)" : "var(--color-sea)"} stroke={isSel ? "var(--color-brass)" : "var(--color-ink)"} strokeWidth={(isSel ? 2.4 : 1.4) * s} />
              {onPort && <circle cx={x} cy={y} r={22 * s} fill="transparent" />}
              <text x={x + L.dx * s} y={y + L.dy * s} textAnchor={L.anchor} fill="var(--color-ink)" fontSize={font} fontFamily="var(--font-display)" letterSpacing=".1em">
                {small ? CODE[n.id] : n.name.toUpperCase()}
              </text>
              <text x={x + L.dx * s} y={y + L.dy * s + 14 * s} textAnchor={L.anchor} fill={n.withhold ? "var(--color-coral)" : "var(--color-brass)"} fontSize={mono} fontFamily="var(--font-mono)">
                #{n.height}{n.withhold && n.secret ? ` +${n.secret} secret` : ""}{!n.online ? " off" : ""}
              </text>
            </g>
          );
        })}
        {!snap && <text x={CHART.width / 2} y={CHART.height / 2} textAnchor="middle" fill="var(--color-muted)" fontSize={font} fontFamily="var(--font-mono)">Raising the sails…</text>}
      </svg>
    </div>
  );
}
