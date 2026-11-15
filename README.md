# Kaudi — a blockchain you can watch, and try to rob

A coin and blockchain built from scratch, running as a live network of eight Indian Ocean ports in your browser.
Real double-SHA-256 proof of work, BIP340 Schnorr signatures, a UTXO ledger, most-work fork choice and reorgs —
with a simulated network you can split, slow down and attack.

- **Heist** — six classic ways to cheat a blockchain. Five get caught, by name. One works.
- **Voyages** — seven hands-on lessons: hashes, signatures, UTXOs, mining races, partitions, a 51% double spend, Merkle proofs.
- **The sea** — free play with every control, and links that replay a run exactly.
- **Rules** and **What's real** — the spec (generated from the validator) and an honest line between real and simulated.

## How it's built

| Layer | Where | Notes |
|---|---|---|
| Consensus | `src/chain` | Byte-exact serialisation, validator with named rules, block tree with most-work tip, mempool with reorg handling. Only `@noble/*` for hash/curve primitives and `@scure/base` for bech32m. |
| Network | `src/sim` | Deterministic discrete-event simulation in a Web Worker: seeded RNG, latency from sea distance, mining on a fixed 50 ms grid so a run replays exactly. |
| UI | `src/app`, `src/components` | Next.js 16, Tailwind 4, SVG chart from Natural Earth coastlines. |

## Tests

```bash
pnpm test                                   # engine: vectors, every rule, reorgs, double spend, replay determinism
pnpm build && pnpm start &                  # then:
BASE_URL=http://localhost:3500 pnpm e2e     # every page and interaction, 17-viewport layout audit
```

Kaudi is a teaching chain. Its coins exist only in your browser tab; there is no token, sale or mainnet.
