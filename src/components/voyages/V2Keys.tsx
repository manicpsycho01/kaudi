"use client";
import { useMemo, useState } from "react";
import { schnorr } from "@noble/curves/secp256k1.js";
import { hex, utf8 } from "@/chain/bytes";
import { ChainState } from "@/chain/chainstate";
import { GENESIS, personKey } from "@/chain/genesis";
import { hash160, sha256 } from "@/chain/hash";
import { encodeAddress, keypair, verify, type Keypair } from "@/chain/keys";
import { ripemd160 } from "@noble/hashes/legacy.js";
import { COIN } from "@/chain/params";
import { finalize, makeSpend } from "@/chain/tx";
import { checkTx, type Reject } from "@/chain/validate";

const msgHash = (m: string) => sha256(utf8("kaudi/message/" + m));

export function V2Keys() {
  const [key, setKey] = useState<Keypair | null>(null);
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState("I, the owner of this key, pay Bilal 5 KAUDI.");
  const [signed, setSigned] = useState<{ sig: Uint8Array; text: string } | null>(null);
  const [withBilal, setWithBilal] = useState(false);
  const [theft, setTheft] = useState<{ label: string; reject: Reject | null }[]>([]);
  const view = useMemo(() => new ChainState(GENESIS).view, []);

  const make = () => { setKey(keypair(schnorr.utils.randomSecretKey())); setSigned(null); setTheft([]); setShow(false); };
  const verifies = key && signed ? verify(signed.sig, msgHash(message), withBilal ? personKey("bilal").pubkey : key.pubkey) : null;

  const steal = (how: "mine" | "hers") => {
    if (!key) return;
    const asha = personKey("asha");
    const coin = { txid: GENESIS.txs[0]!.id, vout: 0 };
    let tx = makeSpend(key, [coin], [{ amount: 99n * COIN, pkh: key.pkh }]);
    let label = "Sign with your own key";
    if (how === "hers") {
      // Claim to be Asha by putting her public key in the input — but the signature is still yours.
      tx = finalize({ ...tx, inputs: [{ ...tx.inputs[0]!, pubkey: asha.pubkey }] });
      label = "Put Asha's public key in, sign with yours";
    }
    const r = checkTx(tx, view, 1);
    setTheft((t) => [...t.filter((x) => x.label !== label), { label, reject: r.ok ? null : r.reject }]);
  };

  return (
    <div className="space-y-14">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" aria-labelledby="k1">
        <div>
          <h2 id="k1" className="display text-[1.7rem]">1 · A key, and the address it makes</h2>
          <p className="mt-2 text-ink-2">A key is just a random 32-byte number. Everything else is computed from it, one way only: you can go from key to address, never back.</p>
          <button type="button" className="btn btn-signal mt-5" onClick={make}>{key ? "Make another key" : "Make me a key"}</button>
        </div>
        <ol className="border border-line bg-sea-2 p-4 text-[15px]" aria-live="polite">
          {!key && <li className="text-muted">No key yet.</li>}
          {key && (
            <>
              <Derive n={1} label="Secret key — never share this" value={show ? hex(key.secret) : "•".repeat(64)} action={<button type="button" className="label min-h-11 text-brass" onClick={() => setShow(!show)}>{show ? "hide" : "reveal"}</button>} />
              <Derive n={2} label="Public key (a point on the secp256k1 curve)" value={hex(key.pubkey)} />
              <Derive n={3} label="SHA-256 of the public key" value={hex(sha256(key.pubkey))} />
              <Derive n={4} label="RIPEMD-160 of that — 20 bytes" value={hex(ripemd160(sha256(key.pubkey)))} />
              <Derive n={5} label="bech32m with the kd prefix — your address" value={encodeAddress(hash160(key.pubkey))} strong />
            </>
          )}
        </ol>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" aria-labelledby="k2">
        <div>
          <h2 id="k2" className="display text-[1.7rem]">2 · A seal nobody can copy</h2>
          <p className="mt-2 text-ink-2">Signing proves you hold the secret key without revealing it. Anyone can check the seal against your public key. Change one character of the message and the seal no longer fits.</p>
        </div>
        <div className={`border border-line bg-sea-2 p-4 ${key ? "" : "opacity-50"}`}>
          <label className="label text-muted" htmlFor="msg">Message</label>
          <textarea id="msg" className="field mt-2 min-h-[5rem] py-2" value={message} onChange={(e) => setMessage(e.target.value)} disabled={!key} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn" disabled={!key} onClick={() => key && setSigned({ sig: schnorr.sign(msgHash(message), key.secret), text: message })}>Sign it</button>
            <button type="button" className="btn" disabled={!signed} aria-pressed={withBilal} onClick={() => setWithBilal(!withBilal)}>{withBilal ? "Check with my key" : "Check with Bilal's key instead"}</button>
          </div>
          {signed && (
            <div className="mt-4" aria-live="polite">
              <p className="label text-muted">Signature (64 bytes)</p>
              <p className="hash text-ink-2">{hex(signed.sig)}</p>
              <p data-testid="verdict" className={`mt-3 text-[16px] ${verifies ? "text-kelp" : "text-coral"}`}>
                {verifies ? "✓ Valid: this exact message was signed by this key." : withBilal ? "✗ Invalid: Bilal's key didn't make this seal." : "✗ Invalid: the message changed after it was signed."}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" aria-labelledby="k3">
        <div>
          <h2 id="k3" className="display text-[1.7rem]">3 · Try to take Asha&apos;s coins</h2>
          <p className="mt-2 text-ink-2">Asha&apos;s 100 KAUDI sit at her address. To spend them, a transaction needs a public key that hashes to her address <em>and</em> a signature from that key. Try it with yours — these run the same validator every port uses.</p>
        </div>
        <div className={`border border-line bg-sea-2 p-4 ${key ? "" : "opacity-50"}`}>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" disabled={!key} onClick={() => steal("mine")}>Sign with your own key</button>
            <button type="button" className="btn" disabled={!key} onClick={() => steal("hers")}>Use her public key, your signature</button>
          </div>
          {!key && <p className="mt-3 text-muted">Make a key first.</p>}
          <ul className="mt-4 space-y-3" aria-live="polite">
            {theft.map((t) => (
              <li key={t.label} className="border-l-2 border-coral pl-3" data-testid="theft">
                <p className="label text-muted">{t.label}</p>
                <p className="text-coral">Refused — {t.reject?.code}</p>
                <p className="text-[15px] text-ink-2">{t.reject?.rule} <span className="text-muted">{t.reject?.detail}</span></p>
              </li>
            ))}
          </ul>
          {theft.length === 2 && <p className="mt-4 text-ink-2">Two locks, both needed: the key must match the address, and the signature must match the key. That&apos;s all “owning” a coin means.</p>}
        </div>
      </section>
    </div>
  );
}

function Derive({ n, label, value, strong, action }: { n: number; label: string; value: string; strong?: boolean; action?: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[1.6rem_minmax(0,1fr)] gap-2 border-t border-line-2 py-3 first:border-t-0 first:pt-0">
      <span className="mono text-[12px] text-brass">{n}</span>
      <div className="min-w-0">
        <p className="flex items-center justify-between gap-2 label text-muted">{label}{action}</p>
        <p className={`hash mt-1 ${strong ? "text-[14px] text-brass" : "text-ink-2"}`}>{value}</p>
      </div>
    </li>
  );
}
