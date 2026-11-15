import { describe, expect, test } from "vitest";
import { GENESIS } from "@/chain/genesis";
import { COIN } from "@/chain/params";
import { Sim } from "@/sim/sim";
import type { PortId } from "@/sim/world";

const tips = (s: Sim) => [...s.nodes.values()].filter((n) => n.online).map((n) => n.chain.tip);
const converged = (s: Sim) => new Set(tips(s)).size === 1;
/** Runs until every node agrees (or gives up). */
function settle(s: Sim, maxMs = 180_000) { for (let t = 0; t < maxMs && !converged(s); t += 500) s.advance(500); return converged(s); }

describe("simulation", () => {
  test("deterministic: the same seed and actions give byte-identical chains", () => {
    const run = () => { const s = new Sim("same-seed"); s.advance(20_000); s.act({ type: "send", from: "asha", to: "bilal", amount: "5" }); s.advance(25_000); return [...s.nodes.values()].map((n) => n.chain.tip).join(); };
    expect(run()).toBe(run());
    const other = new Sim("other-seed"); other.advance(45_000);
    expect(other.blocks.size).toBeGreaterThan(1);
  }, 120_000);

  test("blocks arrive roughly every 8 simulated seconds and every port ends up agreeing", () => {
    const s = new Sim("pace");
    s.advance(160_000);
    expect(settle(s)).toBe(true);
    const h = s.node("calicut").chain.height;
    expect(h).toBeGreaterThan(8);
    expect(h).toBeLessThan(40);
  }, 120_000);

  test("a payment gossips to every port and gets confirmed", () => {
    const s = new Sim("pay");
    const r = s.act({ type: "send", from: "asha", to: "chen", amount: "12.5" });
    expect(r.ok).toBe(true);
    s.advance(4_000);
    for (const n of s.nodes.values()) expect(n.mempool.has(r.ref!) || n.chain.confirmations(r.ref!) > 0).toBe(true);
    s.advance(40_000); settle(s);
    expect(s.node("malacca").chain.confirmations(r.ref!)).toBeGreaterThan(0);
    expect(s.balance("chen", "malacca").confirmed).toBe(112n * COIN + 50_000_000n);
  }, 120_000);

  test("monsoon: the two halves grow separate chains, then the side with less work reorgs when the sea reopens", () => {
    const s = new Sim("monsoon");
    s.advance(10_000); settle(s);
    s.act({ type: "monsoon", on: true });
    s.advance(80_000);
    const west = s.node("aden").chain.tip, east = s.node("kolkata").chain.tip;
    expect(west).not.toBe(east);
    s.act({ type: "monsoon", on: false });
    expect(settle(s)).toBe(true);
    expect(s.log.some((l) => l.kind === "reorg")).toBe(true);
  }, 180_000);

  test("forged blocks are rejected by every honest neighbour with the rule they broke", () => {
    for (const [kind, code] of [["overpay", "block-reward"], ["nopow", "block-pow"], ["future", "block-time-future"], ["steal", "block-tx"]] as const) {
      const s = new Sim("forge-" + kind);
      s.advance(2_000);
      const r = s.act({ type: "forge", node: "surat", kind });
      expect(r.ok).toBe(true);
      s.advance(5_000);
      const neighbours: PortId[] = ["aden", "calicut"];
      for (const id of neighbours) expect(s.node(id).rejects.map((x) => x.reject.code)).toContain(code);
      expect(s.node("aden").chain.tip).not.toBe(r.ref);
    }
  }, 120_000);

  test("double spend: a corsair with most of the hash power reverses a payment after the merchant saw it confirmed", () => {
    const s = new Sim("heist", { hashrates: { socotra: 9_000 } });
    s.act({ type: "withhold", node: "socotra", on: true });
    // The public payment to the merchant (Dara, at Calicut)…
    const pay = s.act({ type: "send", from: "corsair", to: "dara", amount: "90", via: "calicut" });
    expect(pay.ok).toBe(true);
    // …and a conflicting payment to himself that only his own island knows about.
    const self = s.act({ type: "send", from: "corsair", to: "corsair", amount: "95", via: "socotra", relay: false });
    expect(self.ok).toBe(true);
    for (let i = 0; i < 400 && s.node("calicut").chain.confirmations(pay.ref!) < 1; i++) s.advance(500);
    expect(s.node("calicut").chain.confirmations(pay.ref!)).toBeGreaterThan(0);
    s.advance(30_000);
    s.act({ type: "release", node: "socotra" });
    settle(s, 60_000);
    expect(s.node("calicut").chain.confirmations(pay.ref!)).toBe(0);
    expect(s.node("calicut").chain.confirmations(self.ref!)).toBeGreaterThan(0);
    expect(s.balance("dara", "calicut").confirmed).toBe(100n * COIN);
  }, 180_000);

  test("genesis funds every demo wallet", () => {
    const s = new Sim();
    expect(s.balance("asha").confirmed).toBe(100n * COIN);
    expect(s.blocks.get(GENESIS.hash)?.miner).toBe("genesis");
  });
});
