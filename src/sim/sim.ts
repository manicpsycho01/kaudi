import { concatBytes } from "@noble/hashes/utils.js";
import { assemble, serializeHeader, TARGET, TARGET_BITS, type Block } from "@/chain/block";
import { hex } from "@/chain/bytes";
import { ChainState, type AcceptResult } from "@/chain/chainstate";
import { GENESIS, GENESIS_ALLOC, PEOPLE, personKey } from "@/chain/genesis";
import { hashNum, sha256d } from "@/chain/hash";
import { decodeAddress, keypairFromSeed, type Keypair } from "@/chain/keys";
import { Mempool } from "@/chain/mempool";
import { blockReward, COIN, DEFAULT_FEE, MTP_WINDOW } from "@/chain/params";
import { makeCoinbase, makeSpend, type Tx } from "@/chain/tx";
import type { Reject } from "@/chain/validate";
import { EventQueue } from "./heap";
import { rng } from "./rng";
import { latencyMs, PORTS, ROUTES, routeKey, WEST, type PortId } from "./world";

export type Msg =
  | { kind: "block"; block: Block }
  | { kind: "tx"; tx: Tx }
  | { kind: "getchain"; locator: string[] }
  | { kind: "blocks"; blocks: Block[] };

export type Action =
  | { type: "send"; from: string; to: string; amount: string; fee?: string; via?: PortId; relay?: boolean }
  | { type: "hashrate"; node: PortId; value: number }
  | { type: "monsoon"; on: boolean }
  | { type: "route"; a: PortId; b: PortId; cut: boolean }
  | { type: "online"; node: PortId; online: boolean }
  | { type: "withhold"; node: PortId; on: boolean }
  | { type: "release"; node: PortId }
  | { type: "forge"; node: PortId; kind: ForgeKind }
  | { type: "watch"; txid: string; label: string }
  | { type: "batch"; actions: Action[] };
export type ForgeKind = "overpay" | "steal" | "nopow" | "future" | "rewrite";

export type LogKind = "mined" | "reorg" | "reject" | "tx" | "net" | "info" | "drop";
export type LogEntry = { t: number; kind: LogKind; node?: PortId; text: string; detail?: string; ref?: string };

type Ev = { t: number; seq: number; type: "deliver"; from: PortId; to: PortId; msg: Msg; boat: number } | { t: number; seq: number; type: "action"; action: Action };

const SLICE_MS = 50;
const START_S = GENESIS.header.time + 30;

class Node {
  chain = new ChainState(GENESIS);
  mempool = new Mempool(this.chain.view);
  key: Keypair;
  online = true;
  withhold = false;
  /** Blocks this node mined but hasn't told anyone about (private mining). */
  secret: Block[] = [];
  rejects: { t: number; reject: Reject; what: string }[] = [];
  private tpl: { parent: string; prefix: Uint8Array; nonce: number; txs: Tx[]; time: number; height: number } | null = null;
  private carry = 0;
  constructor(readonly id: PortId, readonly name: string, public hashrate: number) { this.key = keypairFromSeed("miner/" + id); }
  invalidate() { this.tpl = null; }

  /** Spends `attempts` real hashes on the current template. Returns a block if one met the target. */
  mine(attempts: number, nowS: number): Block | null {
    this.carry += attempts;
    let n = Math.floor(this.carry);
    this.carry -= n;
    if (!this.online) { this.carry = 0; return null; }
    if (!n) return null;
    if (!this.tpl || this.tpl.parent !== this.chain.tip) this.build(nowS);
    const t = this.tpl!;
    const buf = new Uint8Array(80);
    buf.set(t.prefix);
    while (n-- > 0) {
      const nonce = t.nonce++;
      buf[76] = nonce & 255; buf[77] = (nonce >>> 8) & 255; buf[78] = (nonce >>> 16) & 255; buf[79] = (nonce >>> 24) & 255;
      if (hashNum(sha256d(buf)) <= TARGET) {
        this.tpl = null;
        return assemble({ version: 1, prevHash: t.parent, time: t.time, bits: TARGET_BITS, nonce }, t.txs);
      }
    }
    return null;
  }
  private build(nowS: number) {
    const tip = this.chain.tipEntry, height = tip.height + 1;
    const times = this.chain.path(tip.block.hash).slice(-MTP_WINDOW).map((h) => this.chain.entries.get(h)!.block.header.time).sort((a, b) => a - b);
    const time = Math.max(nowS, times[Math.floor(times.length / 2)]! + 1);
    const { txs, fees } = this.mempool.template();
    const cb = makeCoinbase(height, [{ amount: blockReward(height) + fees, pkh: this.key.pkh }], `Mined at ${this.name}`);
    const all = [cb, ...txs];
    const header = assemble({ version: 1, prevHash: tip.block.hash, time, bits: TARGET_BITS, nonce: 0 }, all).header;
    this.tpl = { parent: tip.block.hash, prefix: serializeHeader(header).slice(0, 76), nonce: 0, txs: all, time, height };
  }
}

export class Sim {
  now = 0;
  readonly nodes = new Map<PortId, Node>();
  readonly cut = new Set<string>();
  monsoon = false;
  log: LogEntry[] = [];
  history: { t: number; action: Action }[] = [];
  /** Payments whose confirmations the page is following, port by port. */
  watched: { txid: string; label: string }[] = [];
  boats = new Map<number, { id: number; from: PortId; to: PortId; sent: number; arrive: number; kind: Msg["kind"]; ref: string; lost?: boolean }>();
  /** Every block any node has seen, for drawing the tree. */
  readonly blocks = new Map<string, { block: Block; miner: string; height: number; foundAt: number }>();
  /** Which miner found each block (by coinbase address). */
  private q = new EventQueue<Ev>();
  private seq = 0;
  private boatSeq = 0;
  private rand: () => number;

  constructor(readonly seed = "kaudi", opts: { hashrates?: Partial<Record<PortId, number>> } = {}) {
    this.rand = rng(seed);
    for (const p of PORTS) this.nodes.set(p.id, new Node(p.id, p.name, opts.hashrates?.[p.id] ?? p.hashrate));
    this.blocks.set(GENESIS.hash, { block: GENESIS, miner: "genesis", height: 0, foundAt: 0 });
  }

  get nowS() { return START_S + Math.floor(this.now / 1000); }
  node(id: PortId) { return this.nodes.get(id)!; }
  private emit(e: Omit<LogEntry, "t">) { this.log.push({ t: this.now, ...e }); if (this.log.length > 400) this.log.splice(0, this.log.length - 400); }

  minerOf(b: Block): string {
    if (b.hash === GENESIS.hash) return "genesis";
    const pkh = hex(b.txs[0]?.outputs[0]?.pkh ?? new Uint8Array());
    for (const n of this.nodes.values()) if (hex(n.key.pkh) === pkh) return n.id;
    return "unknown";
  }

  // ── network ──────────────────────────────────────────────
  peers(id: PortId): PortId[] { return ROUTES.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : [])); }
  linkUp(a: PortId, b: PortId) {
    if (!this.node(a).online || !this.node(b).online) return false;
    if (this.cut.has(routeKey(a, b))) return false;
    if (this.monsoon && WEST.includes(a) !== WEST.includes(b)) return false;
    return true;
  }
  private send(from: PortId, to: PortId, msg: Msg) {
    if (!this.linkUp(from, to)) return;
    const jitter = Math.floor(this.rand() * 120);
    const t = this.now + latencyMs(from, to) + jitter + (msg.kind === "blocks" ? 40 * msg.blocks.length : 0);
    const id = ++this.boatSeq;
    const ref = msg.kind === "block" ? msg.block.hash : msg.kind === "tx" ? msg.tx.id : msg.kind === "blocks" ? `${msg.blocks.length} blocks` : "sync";
    this.boats.set(id, { id, from, to, sent: this.now, arrive: t, kind: msg.kind, ref });
    this.q.push({ t, seq: ++this.seq, type: "deliver", from, to, msg, boat: id });
  }
  private broadcast(from: PortId, msg: Msg, except?: PortId) { for (const p of this.peers(from)) if (p !== except) this.send(from, p, msg); }

  private deliver(e: Extract<Ev, { type: "deliver" }>) {
    const boat = this.boats.get(e.boat);
    this.boats.delete(e.boat);
    if (!this.linkUp(e.from, e.to)) { if (boat) this.emit({ kind: "net", node: e.to, text: `A message from ${this.node(e.from).name} was lost at sea.` }); return; }
    const n = this.node(e.to), m = e.msg;
    if (m.kind === "block") this.receiveBlocks(n, [m.block], e.from);
    else if (m.kind === "blocks") this.receiveBlocks(n, m.blocks, e.from);
    else if (m.kind === "tx") this.receiveTx(n, m.tx, e.from);
    else if (m.kind === "getchain") {
      const known = new Set(m.locator);
      const path = n.chain.mainChain();
      let i = path.length - 1;
      while (i > 0 && !known.has(path[i]!)) i--;
      const blocks = path.slice(i + 1, i + 1 + 60).map((h) => n.chain.entries.get(h)!.block);
      if (blocks.length) this.send(n.id, e.from, { kind: "blocks", blocks });
    }
  }

  private locator(n: Node) { const p = n.chain.mainChain(); return [...p.slice(-30), p[0]!]; }

  private receiveBlocks(n: Node, blocks: Block[], from: PortId | null) {
    let asked = false;
    for (const b of blocks) {
      if (n.chain.entries.has(b.hash)) continue;
      const results = n.chain.accept(b, this.nowS, this.now);
      for (const r of results) this.afterAccept(n, b, r, from);
      if (results[0]?.kind === "orphan" && from && !asked) { asked = true; this.send(n.id, from, { kind: "getchain", locator: this.locator(n) }); }
    }
  }

  private afterAccept(n: Node, b: Block, r: AcceptResult, from: PortId | null) {
    if (r.kind === "invalid") {
      n.rejects.push({ t: this.now, reject: r.reject, what: `block ${b.hash.slice(0, 10)}…` });
      this.emit({ kind: "reject", node: n.id, text: `${n.name} rejected block ${b.hash.slice(0, 8)}…: ${r.reject.rule}`, detail: r.reject.detail, ref: b.hash });
      return;
    }
    if (r.kind !== "accepted") return;
    if (!this.blocks.has(b.hash)) this.blocks.set(b.hash, { block: b, miner: this.minerOf(b), height: n.chain.entries.get(b.hash)!.height, foundAt: this.now });
    if (r.newTip) {
      if (r.reorg) {
        const lost = r.reorg.disconnected.length;
        this.emit({ kind: "reorg", node: n.id, text: `${n.name} switched to a chain with more work: ${lost} block${lost === 1 ? "" : "s"} orphaned.`, ref: r.reorg.forkPoint });
      }
      const u = n.mempool.update(n.chain.view, n.chain.height, r.reorg, r.reorg ? r.reorg.connected : [b]);
      for (const d of u.dropped) this.emit({ kind: "drop", node: n.id, text: `${n.name} dropped transaction ${d.tx.id.slice(0, 8)}…: ${d.reason}`, ref: d.tx.id });
      n.invalidate();
    }
    // Withholding nodes keep their own blocks secret, but relay other people's (to look honest).
    if (!(n.withhold && n.secret.some((s) => s.hash === b.hash))) this.broadcast(n.id, { kind: "block", block: b }, from ?? undefined);
  }

  private receiveTx(n: Node, tx: Tx, from: PortId | null, relay = true) {
    if (n.mempool.has(tx.id) || n.chain.confirmations(tx.id)) return { ok: true as const };
    const r = n.mempool.add(tx, n.chain.height + 1, this.now);
    if (!r.ok) {
      n.rejects.push({ t: this.now, reject: r.reject, what: `transaction ${tx.id.slice(0, 10)}…` });
      this.emit({ kind: "reject", node: n.id, text: `${n.name} refused transaction ${tx.id.slice(0, 8)}…: ${r.reject.rule}`, detail: r.reject.detail, ref: tx.id });
      return r;
    }
    n.invalidate();
    if (relay) this.broadcast(n.id, { kind: "tx", tx }, from ?? undefined);
    return r;
  }

  /** When a lane reopens, both ends compare chains and swap pending transactions. */
  private resync(a: PortId, b: PortId) {
    if (!this.linkUp(a, b)) return;
    for (const [x, y] of [[a, b], [b, a]] as const) {
      this.send(x, y, { kind: "getchain", locator: this.locator(this.node(x)) });
      for (const t of this.node(x).mempool.txs) this.send(x, y, { kind: "tx", tx: t.tx });
    }
  }
  private resyncAll() { for (const [a, b] of ROUTES) this.resync(a, b); }

  // ── actions ──────────────────────────────────────────────
  /** Applies an action now and records it for replay. Returns a result for actions that can fail. */
  act(action: Action): { ok: boolean; message: string; ref?: string } {
    this.history.push({ t: this.now, action });
    return this.apply(action);
  }
  /** Schedules an action at a future simulated time (used by scripted voyages). */
  schedule(t: number, action: Action) { this.q.push({ t, seq: ++this.seq, type: "action", action }); }

  private apply(a: Action): { ok: boolean; message: string; ref?: string } {
    switch (a.type) {
      case "send": return this.sendCoins(a);
      case "hashrate": this.node(a.node).hashrate = Math.max(0, a.value); return { ok: true, message: "" };
      case "monsoon": {
        this.monsoon = a.on;
        this.emit({ kind: "net", text: a.on ? "The monsoon closes the sea between west and east." : "The monsoon lifts. Ports compare chains." });
        if (!a.on) this.resyncAll();
        return { ok: true, message: "" };
      }
      case "route": {
        const k = routeKey(a.a, a.b);
        if (a.cut) this.cut.add(k); else { this.cut.delete(k); this.resync(a.a, a.b); }
        return { ok: true, message: "" };
      }
      case "online": {
        this.node(a.node).online = a.online;
        if (a.online) for (const p of this.peers(a.node)) this.resync(a.node, p);
        return { ok: true, message: "" };
      }
      case "withhold": { this.node(a.node).withhold = a.on; return { ok: true, message: "" }; }
      case "release": {
        const n = this.node(a.node);
        const blocks = n.chain.mainChain().map((h) => n.chain.entries.get(h)!.block).filter((b) => n.secret.some((s) => s.hash === b.hash));
        n.secret = [];
        n.withhold = false;
        if (blocks.length) {
          this.emit({ kind: "net", node: n.id, text: `${n.name} reveals ${blocks.length} secretly mined block${blocks.length === 1 ? "" : "s"}.` });
          for (const p of this.peers(n.id)) this.send(n.id, p, { kind: "blocks", blocks });
        }
        return { ok: true, message: "" };
      }
      case "forge": return this.forge(a.node, a.kind);
      case "batch": {
        // Several actions at the same simulated instant — e.g. two conflicting payments sent at once.
        const rs = a.actions.map((x) => this.apply(x));
        return { ok: rs.every((r) => r.ok), message: rs.map((r) => r.message).filter(Boolean).join(" "), ref: rs.map((r) => r.ref ?? "").join(",") };
      }
      case "watch": if (!this.watched.some((w) => w.txid === a.txid)) this.watched.push({ txid: a.txid, label: a.label }); return { ok: true, message: "" };
    }
  }

  wallet(person: string) {
    const p = PEOPLE.find((x) => x.id === person)!;
    return { person: p, key: personKey(p.id), node: this.node(p.home as PortId) };
  }
  balance(person: string, at?: PortId) {
    const { key, node } = this.wallet(person);
    const n = at ? this.node(at) : node;
    return { confirmed: n.chain.view.balance(key.pkh), pending: n.mempool.pendingView.balance(key.pkh) };
  }

  private sendCoins(a: Extract<Action, { type: "send" }>) {
    const { person, key, node: home } = this.wallet(a.from);
    const node = a.via ? this.node(a.via) : home;
    const toPkh = PEOPLE.some((p) => p.id === a.to) ? personKey(a.to).pkh : decodeAddress(a.to);
    if (!toPkh) return { ok: false, message: "That isn't a valid Kaudi address." };
    const amount = parseAmount(a.amount), fee = a.fee ? parseAmount(a.fee) : DEFAULT_FEE;
    if (amount === null || amount <= 0n) return { ok: false, message: "Enter an amount above zero." };
    if (fee === null || fee < 0n) return { ok: false, message: "The fee can't be negative." };
    // Coin selection: oldest spendable coins first, including this node's pending change.
    const coins = node.mempool.pendingView.byOwner(key.pkh).filter((c) => !c.coinbase || c.height === 0 || node.chain.height + 1 - c.height >= 6);
    const picked = [];
    let sum = 0n;
    for (const c of coins) { if (sum >= amount + fee) break; picked.push(c); sum += c.amount; }
    if (sum < amount + fee) return { ok: false, message: `${person.name} only has ${fmt(sum)} spendable here.` };
    const outs = [{ amount, pkh: toPkh }];
    if (sum - amount - fee > 0n) outs.push({ amount: sum - amount - fee, pkh: key.pkh });
    const tx = makeSpend(key, picked.map((c) => ({ txid: c.txid, vout: c.vout })), outs);
    const r = this.receiveTx(node, tx, null, a.relay !== false);
    if (!r.ok) return { ok: false, message: (r as { reject: Reject }).reject.rule };
    this.emit({ kind: "tx", node: node.id, text: `${person.name} sends ${fmt(amount)} from ${node.name}${a.relay === false ? " — kept private" : ""}.`, ref: tx.id });
    return { ok: true, message: "Sent.", ref: tx.id };
  }

  /** Builds a deliberately invalid block or transaction at `node` and sends it out, so you can watch everyone reject it. */
  private forge(id: PortId, kind: ForgeKind) {
    const n = this.node(id), tip = n.chain.tipEntry, height = tip.height + 1;
    const mk = (txs: Tx[], extra = 0n, time = this.nowS, pow = true, parent = tip) => {
      const cb = makeCoinbase(parent.height + 1, [{ amount: blockReward(parent.height + 1) + extra, pkh: n.key.pkh }], `Forged at ${n.name}`);
      for (let nonce = 0; nonce < 2_000_000; nonce++) {
        const b = assemble({ version: 1, prevHash: parent.block.hash, time: Math.max(time, parent.block.header.time + 1), bits: TARGET_BITS, nonce }, [cb, ...txs]);
        const good = hashNum(Uint8Array.from(b.hash.match(/../g)!.map((x) => parseInt(x, 16)))) <= TARGET;
        if (good === pow) return b;
      }
      throw new Error("could not forge");
    };
    let block: Block;
    let label: string;
    if (kind === "overpay") { block = mk([], 1000n * COIN); label = "pays its miner 1,000 KAUDI instead of 50"; }
    else if (kind === "nopow") { block = mk([], 0n, this.nowS, false); label = "skips the proof of work"; }
    else if (kind === "future") { block = mk([], 0n, this.nowS + 3600); label = "is stamped an hour in the future"; }
    else if (kind === "steal") {
      const victim = this.wallet("asha");
      const coin = n.chain.view.byOwner(victim.key.pkh)[0];
      if (!coin) return { ok: false, message: "Asha has no coins to steal right now." };
      const thief = personKey("corsair");
      const tx = makeSpend(thief, [{ txid: coin.txid, vout: coin.vout }], [{ amount: coin.amount, pkh: thief.pkh }]);
      block = mk([tx]);
      label = "spends Asha's coin with the Corsair's key";
    } else {
      // rewrite: take an old block on the main chain and change who its coinbase pays, keeping the old proof of work.
      const path = n.chain.mainChain();
      const old = n.chain.entries.get(path[Math.max(1, path.length - 4)]!);
      if (!old || old.height === 0) return { ok: false, message: "Mine a few blocks first." };
      const cb = makeCoinbase(old.height, [{ amount: blockReward(old.height), pkh: n.key.pkh }], `Rewritten at ${n.name}`);
      const txs = [cb, ...old.block.txs.slice(1)];
      // Same header, new Merkle root, old nonce: the proof of work no longer fits.
      const header = { ...old.block.header, merkleRoot: assemble(old.block.header, txs).header.merkleRoot };
      block = { header, txs, hash: hex(sha256d(serializeHeader(header))) };
      label = `rewrites block #${old.height} to pay ${n.name}`;
    }
    void height;
    this.emit({ kind: "info", node: id, text: `${n.name} broadcasts a forged block that ${label}.`, ref: block.hash });
    for (const p of this.peers(id)) this.send(id, p, { kind: "block", block });
    return { ok: true, message: label, ref: block.hash };
  }

  // ── time ─────────────────────────────────────────────────
  /**
   * Advances simulated time by `ms`. Mining happens on a fixed grid (every 50 simulated ms, a fixed number of
   * hashes per port), and anything scheduled strictly before a grid point runs before that point's hashing.
   * So the outcome never depends on how the caller chunks time — which is what makes shared replays exact.
   */
  advance(ms: number) {
    const end = this.now + ms;
    for (;;) {
      const B = (Math.floor(this.now / SLICE_MS) + 1) * SLICE_MS;
      for (let e = this.q.peek(); e && e.t < B && e.t <= end; e = this.q.peek()) {
        this.q.pop();
        this.now = Math.max(this.now, e.t);
        if (e.type === "deliver") this.deliver(e);
        else this.apply(e.action);
      }
      if (B > end) { this.now = end; return; }
      this.now = B;
      for (const n of this.nodes.values()) {
        const b = n.mine((n.hashrate * SLICE_MS) / 1000, this.nowS);
        if (!b) continue;
        this.blocks.set(b.hash, { block: b, miner: n.id, height: n.chain.tipEntry.height + 1, foundAt: this.now });
        const rs = n.chain.accept(b, this.nowS, this.now);
        if (n.withhold) n.secret.push(b);
        this.emit({ kind: "mined", node: n.id, text: `${n.name} found block #${n.chain.entries.get(b.hash)?.height ?? "?"}${n.withhold ? " — and keeps it secret" : ""}.`, ref: b.hash });
        for (const r of rs) this.afterAccept(n, b, r, null);
      }
    }
  }
}

export function parseAmount(s: string): bigint | null {
  const m = /^\s*(\d+)(?:\.(\d{0,8}))?\s*$/.exec(s);
  if (!m) return null;
  return BigInt(m[1]!) * COIN + BigInt((m[2] ?? "").padEnd(8, "0"));
}
export const fmt = (k: bigint) => {
  const neg = k < 0n, a = neg ? -k : k;
  const whole = a / COIN, frac = (a % COIN).toString().padStart(8, "0").replace(/0+$/, "");
  return `${neg ? "−" : ""}${whole.toLocaleString("en-US")}${frac ? "." + frac : ""} KAUDI`;
};
export { GENESIS_ALLOC, concatBytes };
