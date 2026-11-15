import { hex } from "@/chain/bytes";
import { PEOPLE, personKey } from "@/chain/genesis";
import { bitsToTarget } from "@/chain/block";
import { merkleProof } from "@/chain/merkle";
import { blockReward } from "@/chain/params";
import type { Tx } from "@/chain/tx";
import type { Sim, LogEntry } from "./sim";
import { ROUTES, routeKey, WEST, type PortId } from "./world";

export type NodeSnap = { id: PortId; name: string; height: number; tip: string; mempool: number; hashrate: number; online: boolean; withhold: boolean; secret: number; lastReject: { t: number; code: string; rule: string; detail: string; what: string } | null };
export type TreeBlock = { hash: string; parent: string; height: number; miner: string; txs: number; tipOf: PortId[]; mainOf: PortId[]; secret: boolean; foundAt: number };
export type Snap = {
  t: number;
  nodes: NodeSnap[];
  links: { a: PortId; b: PortId; up: boolean; cut: boolean }[];
  monsoon: boolean;
  boats: { id: number; from: PortId; to: PortId; sent: number; arrive: number; kind: string; ref: string }[];
  tree: TreeBlock[];
  people: { id: string; name: string; home: PortId; address: string; confirmed: bigint; pending: bigint }[];
  log: LogEntry[];
  bestHeight: number;
};

/** A plain-data picture of the simulation for the page (bigints survive postMessage). */
export function snapshot(sim: Sim, window = 18): Snap {
  const nodes = [...sim.nodes.values()];
  const mains = new Map(nodes.map((n) => [n.id, new Set(n.chain.mainChain())]));
  const bestHeight = Math.max(...nodes.map((n) => n.chain.height));
  const tree: TreeBlock[] = [];
  for (const [hash, b] of sim.blocks) {
    if (b.height < bestHeight - window) continue;
    // Only show a block once at least one node has accepted it as valid.
    const holders = nodes.filter((n) => n.chain.entries.get(hash)?.status === "valid");
    if (!holders.length) continue;
    tree.push({
      hash, parent: b.block.header.prevHash, height: b.height, miner: b.miner, txs: b.block.txs.length,
      tipOf: nodes.filter((n) => n.chain.tip === hash).map((n) => n.id),
      mainOf: nodes.filter((n) => mains.get(n.id)!.has(hash)).map((n) => n.id),
      secret: nodes.some((n) => n.secret.some((s) => s.hash === hash)),
      foundAt: b.foundAt,
    });
  }
  tree.sort((a, b) => a.height - b.height || a.foundAt - b.foundAt);
  return {
    t: sim.now,
    nodes: nodes.map((n) => {
      const r = n.rejects.at(-1);
      return { id: n.id, name: n.name, height: n.chain.height, tip: n.chain.tip, mempool: n.mempool.size, hashrate: n.hashrate, online: n.online, withhold: n.withhold, secret: n.secret.length, lastReject: r ? { t: r.t, what: r.what, ...r.reject } : null };
    }),
    links: ROUTES.map(([a, b]) => ({ a, b, up: sim.linkUp(a, b), cut: sim.cut.has(routeKey(a, b)) || (sim.monsoon && WEST.includes(a) !== WEST.includes(b)) })),
    monsoon: sim.monsoon,
    boats: [...sim.boats.values()],
    tree,
    people: PEOPLE.map((p) => { const bal = sim.balance(p.id); return { id: p.id, name: p.name, home: p.home as PortId, address: personKey(p.id).address, ...bal }; }),
    log: sim.log.slice(-80),
    bestHeight,
  };
}

const addr = (pkh: Uint8Array) => {
  for (const p of PEOPLE) if (hex(personKey(p.id).pkh) === hex(pkh)) return p.name;
  return null;
};

export type TxDetail = { id: string; coinbase: string | null; inputs: { from: string; owner: string | null; amount: bigint | null }[]; outputs: { to: string; owner: string | null; amount: bigint }[]; fee: bigint | null; confirmations: number };
export type BlockDetail = {
  hash: string; height: number; miner: string; header: { version: number; prevHash: string; merkleRoot: string; time: number; bits: string; nonce: number };
  target: string; reward: bigint; txs: TxDetail[]; seenBy: PortId[]; mainOf: PortId[]; size: number; proof: { txid: string; steps: { hash: string; side: string }[] }[];
};

function describeTx(sim: Sim, at: PortId, tx: Tx): TxDetail {
  const n = sim.node(at);
  const encode = (pkh: Uint8Array) => { for (const p of PEOPLE) { const k = personKey(p.id); if (hex(k.pkh) === hex(pkh)) return k.address; } for (const m of sim.nodes.values()) if (hex(m.key.pkh) === hex(pkh)) return m.key.address; return hex(pkh); };
  const ownerOf = (pkh: Uint8Array) => addr(pkh) ?? [...sim.nodes.values()].find((m) => hex(m.key.pkh) === hex(pkh))?.name.concat(" (miner)") ?? null;
  let inSum: bigint | null = 0n;
  const inputs = tx.inputs.map((i) => {
    const src = findTx(sim, at, i.prevTxid);
    const o = src?.outputs[i.vout];
    if (!o) inSum = null; else if (inSum !== null) inSum += o.amount;
    return { from: `${i.prevTxid}:${i.vout}`, owner: o ? ownerOf(o.pkh) : null, amount: o?.amount ?? null };
  });
  const out = tx.outputs.reduce((s, o) => s + o.amount, 0n);
  return {
    id: tx.id, coinbase: tx.coinbase ? tx.coinbase.message || `Coinbase for block #${tx.coinbase.height}` : null,
    inputs, outputs: tx.outputs.map((o) => ({ to: encode(o.pkh), owner: ownerOf(o.pkh), amount: o.amount })),
    fee: tx.coinbase || inSum === null ? null : (inSum as bigint) - out, confirmations: n.chain.confirmations(tx.id),
  };
}
function findTx(sim: Sim, at: PortId, id: string): Tx | undefined {
  const n = sim.node(at);
  for (const e of n.chain.entries.values()) { const t = e.block.txs.find((x) => x.id === id); if (t) return t; }
  return n.mempool.txs.find((t) => t.tx.id === id)?.tx;
}

export function blockDetail(sim: Sim, hash: string, at: PortId): BlockDetail | null {
  const b = sim.blocks.get(hash);
  if (!b) return null;
  const nodes = [...sim.nodes.values()];
  const ids = b.block.txs.map((t) => t.id);
  return {
    hash, height: b.height, miner: b.miner,
    header: { ...b.block.header, bits: "0x" + b.block.header.bits.toString(16) },
    target: bitsToTarget(b.block.header.bits).toString(16).padStart(64, "0"),
    reward: blockReward(b.height),
    txs: b.block.txs.map((t) => describeTx(sim, at, t)),
    seenBy: nodes.filter((n) => n.chain.entries.get(hash)?.status === "valid").map((n) => n.id),
    mainOf: nodes.filter((n) => n.chain.isOnMain(hash)).map((n) => n.id),
    size: 80 + b.block.txs.length,
    proof: ids.map((txid, i) => ({ txid, steps: merkleProof(ids, i) })),
  };
}
export function txDetail(sim: Sim, id: string, at: PortId): TxDetail | null {
  const t = findTx(sim, at, id) ?? [...sim.nodes.values()].map((n) => findTx(sim, n.id, id)).find(Boolean);
  return t ? describeTx(sim, at, t) : null;
}
