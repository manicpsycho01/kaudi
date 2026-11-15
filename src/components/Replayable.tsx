"use client";
import { useEffect, useState } from "react";
import type { Action } from "@/sim/sim";
import { decodeRun } from "./ShareRun";

export type Run = { seed: string; script: { t: number; action: Action }[] };

/** Reads ?run= once on mount, then renders the page with that replay (or none). */
export function Replayable({ children }: { children: (run: Run | null) => React.ReactNode }) {
  const [run, setRun] = useState<Run | null | undefined>(undefined);
  useEffect(() => {
    const r = decodeRun<Run>(new URLSearchParams(location.search).get("run"));
    setRun(r && typeof r.seed === "string" && Array.isArray(r.script) ? r : null);
  }, []);
  if (run === undefined) return <p className="mx-auto max-w-[1400px] px-4 py-10 text-muted sm:px-8">Raising the sails…</p>;
  return (
    <>
      {run && (
        <p role="status" className="border-b border-brass/40 bg-sea-3 px-4 py-3 text-center text-[15px] text-ink-2">
          You&apos;re watching a shared run — every block, payment and trick happens exactly as it did for the person who sent it.
        </p>
      )}
      {children(run)}
    </>
  );
}
