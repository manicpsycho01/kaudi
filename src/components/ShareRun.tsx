"use client";
import { useState } from "react";
import type { SimHandle } from "@/lib/useSim";

/** Copies a link that replays this exact run: same seed, same actions at the same simulated moments. */
export function ShareRun({ sim, path }: { sim: SimHandle; path: string }) {
  const [state, setState] = useState<"idle" | "copied" | "shown">("idle");
  const [link, setLink] = useState("");
  const share = async () => {
    const run = await sim.history();
    const url = `${location.origin}${path}?run=${encodeRun(run)}`;
    setLink(url);
    try { await navigator.clipboard.writeText(url); setState("copied"); } catch { setState("shown"); }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn" onClick={() => void share()} title="Anyone with the link sees exactly this run">Share this run</button>
      {state === "copied" && <span role="status" className="label text-kelp">Link copied</span>}
      {state === "shown" && <input readOnly className="field max-w-[16rem]" value={link} aria-label="Replay link" onFocus={(e) => e.currentTarget.select()} />}
    </div>
  );
}

export const encodeRun = (run: unknown) => btoa(unescape(encodeURIComponent(JSON.stringify(run)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export function decodeRun<T>(s: string | null | undefined): T | null {
  if (!s) return null;
  try { return JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))))) as T; } catch { return null; }
}
