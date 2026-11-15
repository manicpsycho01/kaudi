import { describe, expect, test } from "vitest";
import fc from "fast-check";
import { assemble, bitsToTarget, GENESIS_NONCE, headerHash, meetsTarget, serializeHeader, TARGET_BITS, targetToBits } from "@/chain/block";
import { hex } from "@/chain/bytes";
import { ChainState } from "@/chain/chainstate";
import { GENESIS, personKey } from "@/chain/genesis";
import { decodeAddress, encodeAddress, keypairFromSeed } from "@/chain/keys";
import { Mempool } from "@/chain/mempool";
import { merkleProof, merkleRoot, verifyProof } from "@/chain/merkle";
import { blockReward, COIN, COINBASE_MATURITY } from "@/chain/params";
import { finalize, makeSpend, serializeTx, sighash, txid } from "@/chain/tx";
import { checkTx } from "@/chain/validate";
import { mine, NOW } from "./helpers";

const asha = personKey("asha"), bilal = personKey("bilal");
const ashaCoin = () => ({ txid: GENESIS.txs[0]!.id, vout: 0 });
const pay = (to: Uint8Array, amount: bigint) => ({ amount, pkh: to });

describe("encoding and hashing (fixed vectors)", () => {
  test("genesis is pinned: its hash meets the target with the hard-coded nonce", () => {
    expect(GENESIS.header.nonce).toBe(GENESIS_NONCE);
    expect(GENESIS.hash).toBe("00009fffed96cfc12548e69c5dbb878d50d50aebc615c8270a2705999984392c");
    expect(meetsTarget(GENESIS.hash, TARGET_BITS)).toBe(true);
  });
  test("a header is exactly 80 bytes and its hash is sha256d of them", () => {
    expect(serializeHeader(GENESIS.header).length).toBe(80);
    expect(headerHash(GENESIS.header)).toBe(GENESIS.hash);
  });
  test("compact bits round-trip like Bitcoin's (0x1d00ffff = difficulty 1)", () => {
    expect(bitsToTarget(0x1d00ffff)).toBe(0xffffn << 208n);
    expect(targetToBits(0xffffn << 208n)).toBe(0x1d00ffff);
    expect(bitsToTarget(TARGET_BITS)).toBeGreaterThan(0n);
  });
  test("addresses are bech32m with a kd prefix and a checksum that catches typos", () => {
    const k = keypairFromSeed("x");
    expect(k.address).toMatch(/^kd1[02-9ac-hj-np-z]{38}$/);
    expect(hex(decodeAddress(k.address)!)).toBe(hex(k.pkh));
    const typo = k.address.slice(0, -1) + (k.address.endsWith("q") ? "p" : "q");
    expect(decodeAddress(typo)).toBeNull();
    expect(decodeAddress(encodeAddress(k.pkh).replace("kd1", "bc1"))).toBeNull();
  });
  test("txid commits to every byte, including signatures; the sighash does not", () => {
    const tx = makeSpend(asha, [ashaCoin()], [pay(bilal.pkh, COIN)]);
    expect(tx.id).toBe(txid(tx));
    const sig2 = { ...tx, inputs: [{ ...tx.inputs[0]!, sig: new Uint8Array(64).fill(1) }] };
    expect(txid(sig2)).not.toBe(tx.id);
    expect(hex(sighash(sig2, 0))).toBe(hex(sighash(tx, 0)));
    expect(serializeTx(tx).length).toBe(4 + 1 + (32 + 4 + 32 + 64) + 1 + (8 + 20));
  });
});

describe("Merkle trees", () => {
  const ids = Array.from({ length: 7 }, (_, i) => hex(new Uint8Array(32).fill(i + 1)));
  test("every leaf has a proof of log2(n) hashes that verifies against the root", () => {
    const root = merkleRoot(ids);
    ids.forEach((id, i) => {
      const p = merkleProof(ids, i);
      expect(p.length).toBe(3);
      expect(verifyProof(id, p, root)).toBe(true);
    });
  });
  test("a proof for a different transaction, or a tampered sibling, fails", () => {
    const root = merkleRoot(ids), p = merkleProof(ids, 2);
    expect(verifyProof(ids[3]!, p, root)).toBe(false);
    expect(verifyProof(ids[2]!, [{ ...p[0]!, hash: "00".repeat(32) }, ...p.slice(1)], root)).toBe(false);
  });
});

describe("transaction rules", () => {
  const view = new ChainState(GENESIS).view;
  const reason = (tx: ReturnType<typeof makeSpend>, spent?: Set<string>) => { const r = checkTx(tx, view, 1, spent); return r.ok ? "ok" : r.reject.code; };
  test("a correctly signed spend of your own coin is valid and the fee is the difference", () => {
    const r = checkTx(makeSpend(asha, [ashaCoin()], [pay(bilal.pkh, 40n * COIN), pay(asha.pkh, 59n * COIN)]), view, 1);
    expect(r).toEqual({ ok: true, value: 1n * COIN });
  });
  test("spending someone else's coin is rejected: wrong owner", () => {
    expect(reason(makeSpend(bilal, [ashaCoin()], [pay(bilal.pkh, COIN)]))).toBe("tx-wrong-owner");
  });
  test("forging a signature, or editing a signed transaction, is rejected", () => {
    const tx = makeSpend(asha, [ashaCoin()], [pay(bilal.pkh, COIN)]);
    expect(reason(finalize({ ...tx, inputs: [{ ...tx.inputs[0]!, sig: new Uint8Array(64).fill(9) }] }))).toBe("tx-bad-signature");
    expect(reason(finalize({ ...tx, outputs: [pay(bilal.pkh, 99n * COIN)] }))).toBe("tx-bad-signature");
  });
  test("overspending, zero/negative outputs, duplicate inputs, missing coins", () => {
    expect(reason(makeSpend(asha, [ashaCoin()], [pay(bilal.pkh, 101n * COIN)]))).toBe("tx-overspend");
    expect(reason(makeSpend(asha, [ashaCoin()], [pay(bilal.pkh, 0n)]))).toBe("tx-bad-amount");
    // A negative amount can't even be serialised (amounts are unsigned 64-bit), so it never reaches a validator.
    expect(() => makeSpend(asha, [ashaCoin()], [pay(bilal.pkh, -5n)])).toThrow(/u64/);
    expect(reason(makeSpend(asha, [ashaCoin(), ashaCoin()], [pay(bilal.pkh, COIN)]))).toBe("tx-duplicate-input");
    expect(reason(makeSpend(asha, [{ txid: "ab".repeat(32), vout: 0 }], [pay(bilal.pkh, COIN)]))).toBe("tx-missing-coin");
  });
  test("property: any valid spend conserves value (inputs = outputs + fee)", () => {
    fc.assert(fc.property(fc.bigInt({ min: 1n, max: 100n * COIN }), fc.bigInt({ min: 0n, max: 100n * COIN }), (a, b) => {
      fc.pre(a + b <= 100n * COIN);
      const outs = [pay(bilal.pkh, a), ...(b > 0n ? [pay(asha.pkh, b)] : [])];
      const r = checkTx(makeSpend(asha, [ashaCoin()], outs), view, 1);
      expect(r.ok && r.value + a + b).toBe(100n * COIN);
    }), { numRuns: 25 });
  });
});

describe("block rules", () => {
  const fresh = () => new ChainState(GENESIS);
  const reject = (c: ChainState, b: ReturnType<typeof mine>) => { const r = c.accept(b, NOW)[0]!; return r.kind === "invalid" ? r.reject.code : r.kind; };
  test("a mined block extends the chain; the coinbase pays the reward", () => {
    const c = fresh();
    const b = mine(c, GENESIS.hash, []);
    expect(c.accept(b, NOW)).toEqual([{ kind: "accepted", reorg: null, newTip: true }]);
    expect(c.height).toBe(1);
    expect(c.view.balance(new Uint8Array(20).fill(7))).toBe(blockReward(1));
  });
  test("no proof of work → rejected", () => {
    const c = fresh(), b = mine(c, GENESIS.hash, []);
    let bad = b;
    for (let n = 0; meetsTarget(bad.hash, TARGET_BITS); n++) bad = assemble({ ...b.header, nonce: n }, b.txs);
    expect(reject(c, bad)).toBe("block-pow");
  });
  test("paying yourself more than reward + fees → rejected with the exact numbers", () => {
    const c = fresh(), r = c.accept(mine(c, GENESIS.hash, [], { extra: 1000n * COIN }), NOW)[0]!;
    expect(r.kind === "invalid" && r.reject.code).toBe("block-reward");
    expect(r.kind === "invalid" && r.reject.detail).toMatch(/pays 1,050 KAUDI; allowed 50 KAUDI/);
  });
  test("changing a transaction after mining breaks the Merkle root", () => {
    const c = fresh();
    const b = mine(c, GENESIS.hash, [makeSpend(asha, [ashaCoin()], [pay(bilal.pkh, COIN)])], { fees: 99n * COIN });
    const forged = { ...b, txs: [b.txs[0]!, makeSpend(asha, [ashaCoin()], [pay(asha.pkh, COIN)])] };
    expect(reject(c, forged)).toBe("block-merkle");
  });
  test("double spend inside one block → rejected", () => {
    const c = fresh();
    const t1 = makeSpend(asha, [ashaCoin()], [pay(bilal.pkh, COIN)]), t2 = makeSpend(asha, [ashaCoin()], [pay(asha.pkh, COIN)]);
    expect(reject(c, mine(c, GENESIS.hash, [t1, t2], { fees: 198n * COIN }))).toBe("block-tx");
  });
  test("timestamps: not after the median of the last 11, or too far in the future → rejected", () => {
    const c = fresh();
    expect(reject(c, mine(c, GENESIS.hash, [], { time: GENESIS.header.time }))).toBe("block-time-old");
    expect(reject(c, mine(c, GENESIS.hash, [], { time: NOW + 500 }))).toBe("block-time-future");
  });
  test("coinbase coins are locked until they mature", () => {
    const c = fresh(), miner = keypairFromSeed("miner");
    let tip = GENESIS.hash;
    const b1 = mine(c, tip, [], { pay: miner.pkh }); c.accept(b1, NOW); tip = b1.hash;
    const spend = makeSpend(miner, [{ txid: b1.txs[0]!.id, vout: 0 }], [pay(bilal.pkh, COIN)]);
    expect(checkTx(spend, c.view, 2).ok).toBe(false);
    for (let i = 0; i < COINBASE_MATURITY - 1; i++) { const b = mine(c, tip, []); c.accept(b, NOW); tip = b.hash; }
    expect(checkTx(spend, c.view, c.height + 1).ok).toBe(true);
  });
  test("a block built on an invalid block is invalid", () => {
    const c = fresh(), bad = mine(c, GENESIS.hash, [], { extra: COIN });
    c.accept(bad, NOW);
    const child = mine(c, bad.hash, []);
    expect(reject(c, child)).toBe("block-parent-invalid");
  });
});

describe("forks and reorgs", () => {
  test("most cumulative work wins; ties keep the first seen; orphaned txs return to the mempool", () => {
    const c = new ChainState(GENESIS);
    const pool = new Mempool(c.view);
    const toBilal = makeSpend(asha, [ashaCoin()], [pay(bilal.pkh, 10n * COIN), pay(asha.pkh, 89n * COIN)]);
    expect(pool.add(toBilal, 1).ok).toBe(true);
    const a1 = mine(c, GENESIS.hash, [toBilal], { fees: COIN, tag: 1 });
    c.accept(a1, NOW); pool.update(c.view, c.height, null, [a1]);
    expect(pool.size).toBe(0);
    expect(c.confirmations(toBilal.id)).toBe(1);
    // A rival block at the same height arrives: a tie, so the first seen stays.
    const b1 = mine(c, GENESIS.hash, [], { tag: 2 });
    expect(c.accept(b1, NOW)[0]).toEqual({ kind: "accepted", reorg: null, newTip: false });
    expect(c.tip).toBe(a1.hash);
    // The rival branch grows longer: reorg. a1 is orphaned and its transaction is unconfirmed again.
    const b2 = mine(c, b1.hash, [], { tag: 3 });
    const r = c.accept(b2, NOW)[0]!;
    expect(r.kind === "accepted" && r.reorg?.disconnected.map((b) => b.hash)).toEqual([a1.hash]);
    expect(c.tip).toBe(b2.hash);
    expect(c.confirmations(toBilal.id)).toBe(0);
    const u = pool.update(c.view, c.height, r.kind === "accepted" ? r.reorg : null, [b1, b2]);
    expect(u.restored.map((t) => t.id)).toEqual([toBilal.id]);
    expect(pool.has(toBilal.id)).toBe(true);
  });
  test("double spend: after a reorg the merchant's payment is dropped because the coin was spent on the winning chain", () => {
    const c = new ChainState(GENESIS), corsair = personKey("corsair");
    const coin = { txid: GENESIS.txs[0]!.id, vout: 7 };
    const toMerchant = makeSpend(corsair, [coin], [pay(asha.pkh, 90n * COIN), pay(corsair.pkh, 9n * COIN)]);
    const toSelf = makeSpend(corsair, [coin], [pay(corsair.pkh, 99n * COIN)]);
    const pool = new Mempool(c.view);
    const honest = mine(c, GENESIS.hash, [toMerchant], { fees: COIN, tag: 1 }); c.accept(honest, NOW);
    const p1 = mine(c, GENESIS.hash, [toSelf], { fees: COIN, tag: 2 }); c.accept(p1, NOW);
    const p2 = mine(c, p1.hash, [], { tag: 3 });
    const r = c.accept(p2, NOW)[0]!;
    expect(c.tip).toBe(p2.hash);
    const u = pool.update(c.view, c.height, r.kind === "accepted" ? r.reorg : null, [p1, p2]);
    expect(u.dropped.map((d) => d.tx.id)).toEqual([toMerchant.id]);
    expect(c.view.balance(asha.pkh)).toBe(100n * COIN);
  });
  test("blocks that arrive before their parent wait as orphans and connect when it shows up", () => {
    const src = new ChainState(GENESIS);
    const b1 = mine(src, GENESIS.hash, []); src.accept(b1, NOW);
    const b2 = mine(src, b1.hash, []);
    const c = new ChainState(GENESIS);
    expect(c.accept(b2, NOW)).toEqual([{ kind: "orphan", missing: b1.hash }]);
    const rs = c.accept(b1, NOW);
    expect(rs.map((r) => r.kind)).toEqual(["accepted", "accepted"]);
    expect(c.tip).toBe(b2.hash);
  });
});

describe("mempool", () => {
  test("first seen wins: a conflicting spend of the same coin is refused", () => {
    const c = new ChainState(GENESIS), pool = new Mempool(c.view);
    expect(pool.add(makeSpend(asha, [ashaCoin()], [pay(bilal.pkh, COIN)]), 1).ok).toBe(true);
    const r = pool.add(makeSpend(asha, [ashaCoin()], [pay(asha.pkh, COIN)]), 1);
    expect(!r.ok && r.reject.code).toBe("tx-conflict");
  });
  test("a pending transaction's change can be spent right away (chained unconfirmed spends)", () => {
    const c = new ChainState(GENESIS), pool = new Mempool(c.view);
    const t1 = makeSpend(asha, [ashaCoin()], [pay(bilal.pkh, COIN), pay(asha.pkh, 98n * COIN)]);
    expect(pool.add(t1, 1).ok).toBe(true);
    expect(pool.add(makeSpend(asha, [{ txid: t1.id, vout: 1 }], [pay(bilal.pkh, 97n * COIN)]), 1).ok).toBe(true);
    expect(pool.template().txs.map((t) => t.id)[0]).toBe(t1.id);
  });
});
