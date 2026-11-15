"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Action } from "@/sim/sim";
import type { BlockDetail, Snap, TxDetail } from "@/sim/snapshot";
import type { FromWorker, ToWorker } from "@/sim/worker";
import type { PortId } from "@/sim/world";

export type SimOptions = Omit<Extract<ToWorker, { type: "init" }>, "type">;

/** Runs a simulation in a Web Worker and exposes its latest snapshot plus controls. */
export function useSim(opts: SimOptions, key = "") {
  const [snap, setSnap] = useState<Snap | null>(null);
  const [speed, setSpeedState] = useState(opts.speed ?? 1);
  const [paused, setPausedState] = useState(!!opts.paused);
  const worker = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, (v: unknown) => void>());
  const seq = useRef(0);
  /** When the latest snapshot arrived (for interpolating boats between snapshots). */
  const received = useRef({ at: 0, t: 0, speed: 1, paused: false });
  const optsRef = useRef(opts);

  useEffect(() => {
    const w = new Worker(new URL("../sim/worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    w.onmessage = (e: MessageEvent<FromWorker>) => {
      const m = e.data;
      if (m.type === "snap") {
        received.current = { at: performance.now(), t: m.snap.t, speed: m.speed, paused: m.paused };
        setSnap(m.snap); setSpeedState(m.speed); setPausedState(m.paused);
      } else { pending.current.get(m.id)?.(m.value); pending.current.delete(m.id); }
    };
    w.postMessage({ type: "init", ...optsRef.current } satisfies ToWorker);
    return () => { w.terminate(); worker.current = null; };
  }, [key]);

  const post = useCallback((m: ToWorker) => worker.current?.postMessage(m), []);
  type Ask = Extract<ToWorker, { id: number }> extends infer U ? (U extends { id: number } ? Omit<U, "id"> : never) : never;
  const ask = useCallback(<T,>(m: Ask) => new Promise<T>((resolve) => {
    const id = ++seq.current;
    pending.current.set(id, resolve as (v: unknown) => void);
    post({ ...m, id } as ToWorker);
  }), [post]);

  return {
    snap, speed, paused, received,
    act: useCallback((action: Action) => ask<{ ok: boolean; message: string; ref?: string }>({ type: "act", action }), [ask]),
    setSpeed: useCallback((value: number) => post({ type: "speed", value }), [post]),
    setPaused: useCallback((value: boolean) => post({ type: "pause", value }), [post]),
    step: useCallback((ms: number) => post({ type: "step", ms }), [post]),
    block: useCallback((hash: string, at: PortId) => ask<BlockDetail | null>({ type: "block", hash, at }), [ask]),
    tx: useCallback((txid: string, at: PortId) => ask<TxDetail | null>({ type: "tx", txid, at }), [ask]),
  };
}
export type SimHandle = ReturnType<typeof useSim>;
