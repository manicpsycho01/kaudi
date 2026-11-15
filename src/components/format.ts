import { COIN } from "@/chain/params";
export const kaudi = (k: bigint | null | undefined, digits = 8) => {
  if (k === null || k === undefined) return "—";
  const neg = k < 0n, a = neg ? -k : k;
  const whole = a / COIN, frac = (a % COIN).toString().padStart(8, "0").slice(0, digits).replace(/0+$/, "");
  return `${neg ? "−" : ""}${whole.toLocaleString("en-US")}${frac ? "." + frac : ""}`;
};
export const clock = (ms: number) => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
export const short = (h: string, n = 10) => h.length > n + 1 ? h.slice(0, n) + "…" : h;
