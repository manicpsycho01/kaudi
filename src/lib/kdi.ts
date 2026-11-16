import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { COIN } from "@/content/coin";

/**
 * Just enough Ethereum to read the KDI contract and send a claim — JSON-RPC by hand, no wallet library.
 * Reads go to the public Base Sepolia endpoint; the claim goes through the visitor's own wallet (EIP-1193).
 */
const sel = (sig: string) => "0x" + bytesToHex(keccak_256(utf8ToBytes(sig))).slice(0, 8);
const pad = (addr: string) => addr.toLowerCase().replace(/^0x/, "").padStart(64, "0");

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const r = await fetch(COIN.rpc, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result as T;
}
const call = (data: string) => rpc<string>("eth_call", [{ to: COIN.address, data }, "latest"]).then((h) => BigInt(h === "0x" ? 0 : h));

export type CoinState = { minted: bigint; supply: bigint; era: bigint; drip: bigint; block: bigint };
export async function readCoin(): Promise<CoinState> {
  const [minted, supply, era, drip, block] = await Promise.all([
    call(sel("minted()")), call(sel("totalSupply()")), call(sel("era()")), call(sel("currentDrip()")), rpc<string>("eth_blockNumber", []).then(BigInt),
  ]);
  return { minted, supply, era, drip, block };
}
export const balanceOf = (a: string) => call(sel("balanceOf(address)") + pad(a));
export const nextClaimAt = (a: string) => call(sel("nextClaimAt(address)") + pad(a));

export type Claim = { to: string; amount: bigint; tx: string; block: bigint };
/**
 * Recent claims, newest first. The public RPC only searches 200 blocks of logs at a time, so history comes from the
 * Blockscout explorer's API instead: a claim is a transfer from the zero address (a mint).
 */
export async function recentClaims(): Promise<Claim[]> {
  const r = await fetch(`${COIN.explorer}/api/v2/tokens/${COIN.address}/transfers`);
  if (!r.ok) return [];
  const j = (await r.json()) as { items?: { from: { hash: string }; to: { hash: string }; total: { value: string }; transaction_hash: string; block_number: number }[] };
  return (j.items ?? []).filter((t) => /^0x0{40}$/i.test(t.from.hash))
    .map((t) => ({ to: t.to.hash, amount: BigInt(t.total.value), tx: t.transaction_hash, block: BigInt(t.block_number) }));
}

/** The claim transaction's calldata. */
export const CLAIM_DATA = sel("claim()");

/** 1 KDI = 10^18 base units; shown with up to `dp` decimals. */
export const kdi = (v: bigint, dp = 2) => {
  const whole = v / 10n ** 18n, frac = v % 10n ** 18n;
  const f = (Number(frac) / 1e18).toFixed(dp).slice(1);
  return whole.toLocaleString("en-IN") + (dp && frac ? f.replace(/\.?0+$/, "") : "");
};
export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
/** Where era `e` ends, mirroring the contract: 21M × (1 − 1/2^(e+1)). */
export const eraEnd = (e: number) => 21_000_000 * (1 - 1 / 2 ** (e + 1));
