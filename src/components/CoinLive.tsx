"use client";
import { useCallback, useEffect, useState } from "react";
import { COIN } from "@/content/coin";
import { balanceOf, CLAIM_DATA, eraEnd, kdi, nextClaimAt, readCoin, recentClaims, short, type Claim, type CoinState } from "@/lib/kdi";

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
const eth = () => (typeof window !== "undefined" ? (window as unknown as { ethereum?: Eth }).ethereum : undefined);
const HEX_CHAIN = "0x" + COIN.chainId.toString(16);
const link = (path: string) => `${COIN.explorer}/${path}`;

/** Live numbers from the chain, the claim button, and the latest claims. */
export function CoinLive() {
  const [state, setState] = useState<CoinState | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [error, setError] = useState("");
  const [account, setAccount] = useState<string | null>(null);
  const [mine, setMine] = useState<{ balance: bigint; next: bigint } | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ text: string; tx?: string; tone: "ok" | "err" } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await readCoin();
      setState(s);
      setClaims((await recentClaims().catch(() => [])).slice(0, 8));
      setError("");
    } catch { setError("Couldn't reach Base Sepolia just now. The numbers will appear when it answers."); }
  }, []);
  const refreshMine = useCallback(async (a: string) => setMine({ balance: await balanceOf(a), next: await nextClaimAt(a) }), []);

  useEffect(() => { refresh(); const t = setInterval(refresh, 20000); return () => clearInterval(t); }, [refresh]);
  useEffect(() => { if (account) refreshMine(account); }, [account, refreshMine]);

  async function connect() {
    const w = eth();
    if (!w) { setMsg({ tone: "err", text: "No wallet found in this browser. Install MetaMask (or open this page in a wallet's browser) to claim." }); return; }
    try {
      const [a] = (await w.request({ method: "eth_requestAccounts" })) as string[];
      try { await w.request({ method: "wallet_switchEthereumChain", params: [{ chainId: HEX_CHAIN }] }); }
      catch (e) {
        if ((e as { code?: number }).code !== 4902) throw e;
        await w.request({ method: "wallet_addEthereumChain", params: [{ chainId: HEX_CHAIN, chainName: COIN.chainName, rpcUrls: [COIN.rpc], blockExplorerUrls: [COIN.explorer], nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 } }] });
      }
      setAccount(a!);
      setMsg(null);
    } catch (e) { setMsg({ tone: "err", text: (e as { code?: number }).code === 4001 ? "You cancelled in your wallet." : "Your wallet didn't connect. Try again." }); }
  }

  async function claim() {
    const w = eth();
    if (!w || !account) return;
    setBusy("Confirm in your wallet…"); setMsg(null);
    try {
      const chain = (await w.request({ method: "eth_chainId" })) as string;
      if (chain.toLowerCase() !== HEX_CHAIN) await w.request({ method: "wallet_switchEthereumChain", params: [{ chainId: HEX_CHAIN }] });
      const tx = (await w.request({ method: "eth_sendTransaction", params: [{ from: account, to: COIN.address, data: CLAIM_DATA }] })) as string;
      setBusy("Waiting for the next block…");
      for (let i = 0; i < 60; i++) {
        const r = await fetch(COIN.rpc, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [tx] }) }).then((x) => x.json());
        if (r.result) {
          setMsg(r.result.status === "0x1" ? { tone: "ok", text: "Claimed. The KDI are in your wallet.", tx } : { tone: "err", text: "The claim was refused by the contract.", tx });
          break;
        }
        await new Promise((res) => setTimeout(res, 2000));
      }
      await Promise.all([refresh(), refreshMine(account)]);
    } catch (e) {
      const m = String((e as { message?: string }).message ?? "");
      setMsg({ tone: "err", text: (e as { code?: number }).code === 4001 ? "You cancelled in your wallet."
        : /insufficient funds|gas/i.test(m) ? "Claiming costs a tiny amount of gas. Get free Base Sepolia ETH from a faucet, then try again."
        : /CoolingDown|0x[0-9a-f]{8}/i.test(m) ? "You've already claimed today. Come back tomorrow." : "The claim didn't go through. Try again." });
    } finally { setBusy(""); }
  }

  async function addToWallet() {
    await eth()?.request({ method: "wallet_watchAsset", params: { type: "ERC20", options: { address: COIN.address, symbol: "KDI", decimals: 18 } } as never }).catch(() => null);
  }

  const issued = state ? Number(state.minted / 10n ** 15n) / 1000 : 0;
  const era = state ? Number(state.era) : 0;
  const now = BigInt(Math.floor(Date.now() / 1000));
  const waiting = mine && mine.next > now;

  return (
    <div className="space-y-10">
      <dl className="grid grid-cols-2 border-t border-l border-line lg:grid-cols-4" aria-live="polite">
        {[
          ["Issued so far", state ? kdi(state.minted) : "…", "KDI ever claimed"],
          ["In circulation", state ? kdi(state.supply) : "…", "issued minus burned"],
          ["Era", state ? String(era) : "…", `ends at ${eraEnd(era).toLocaleString("en-IN")} KDI`],
          ["A claim pays", state ? kdi(state.drip, 6) : "…", "KDI, once a day per address"],
        ].map(([k, v, s]) => (
          <div key={k} className="border-r border-b border-line p-4 sm:p-5">
            <dt className="label text-muted">{k}</dt>
            <dd className="display mt-2 text-[clamp(1.5rem,3vw,2.2rem)] tabular-nums">{v}</dd>
            <dd className="text-[14px] text-muted">{s}</dd>
          </div>
        ))}
      </dl>

      <div>
        <p className="label text-muted">Progress to 21,000,000</p>
        <div className="mt-2 h-3 border border-line" role="meter" aria-label="Share of the 21 million cap issued" aria-valuemin={0} aria-valuemax={21_000_000} aria-valuenow={Math.round(issued)}>
          <div className="h-full bg-brass" style={{ width: `${Math.max(0.4, (issued / 21_000_000) * 100)}%` }} />
        </div>
        <p className="mt-2 text-[14px] text-muted">{((issued / 21_000_000) * 100).toFixed(6)}% issued. The first 10.5 million pay 100 KDI a claim; every era after pays half.</p>
      </div>

      <section aria-labelledby="claim-h" className="border border-brass/40 p-5 sm:p-7">
        <h2 id="claim-h" className="display text-[1.8rem]">Claim your KDI</h2>
        <p className="mt-2 max-w-2xl text-ink-2">You need a wallet like MetaMask and a few cents of free test ETH on Base Sepolia for gas. KDI on a test network has no value — which is the point.</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {!account ? <button type="button" className="btn btn-signal" onClick={connect}>Connect wallet</button> : (
            <>
              <button type="button" className="btn btn-signal" onClick={claim} disabled={!!busy || !!waiting || !state?.drip}>{busy || (waiting ? "Claimed today" : `Claim ${state ? kdi(state.drip, 6) : ""} KDI`)}</button>
              <button type="button" className="btn" onClick={addToWallet}>Show KDI in my wallet</button>
              <span className="text-[15px] text-ink-2">{short(account)} · {mine ? `${kdi(mine.balance)} KDI` : "…"}{waiting ? ` · next claim ${new Date(Number(mine!.next) * 1000).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}` : ""}</span>
            </>
          )}
        </div>
        {msg && <p role={msg.tone === "ok" ? "status" : "alert"} className={`mt-4 border px-4 py-3 ${msg.tone === "ok" ? "border-kelp/40 bg-kelp-soft" : "border-coral/40 bg-coral-soft"}`}>{msg.text}{msg.tx && <> <a className="underline underline-offset-4" href={link(`tx/${msg.tx}`)} target="_blank" rel="noreferrer">See the transaction</a></>}</p>}
      </section>

      <section aria-labelledby="recent-h">
        <h2 id="recent-h" className="label text-muted">Latest claims</h2>
        {error ? <p className="mt-3 text-coral">{error}</p> : !claims.length ? <p className="mt-3 text-ink-2">{state ? "No claims yet." : "Loading…"}</p> : (
          <ul className="mt-3 border-t border-line">
            {claims.map((c) => (
              <li key={c.tx} className="flex flex-wrap justify-between gap-x-6 border-b border-line py-3 text-[15px]">
                <a className="font-mono hover:text-brass" href={link(`address/${c.to}`)} target="_blank" rel="noreferrer">{short(c.to)}</a>
                <span className="tabular-nums">{kdi(c.amount, 6)} KDI <span className="text-muted">· block {c.block.toString()}</span></span>
                <a className="label text-muted hover:text-brass" href={link(`tx/${c.tx}`)} target="_blank" rel="noreferrer">Transaction ↗</a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
