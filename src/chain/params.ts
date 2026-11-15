/**
 * Consensus rules. Bitcoin's shape, scaled down so a voyage fits in a few minutes.
 * Amounts are integers of "kani"; 1 KAUDI = 100,000,000 kani (like satoshis).
 */
export const COIN = 100_000_000n;
export const BLOCK_REWARD = 50n * COIN;
export const HALVING_INTERVAL = 150;
export const MAX_MONEY = 21_000_000n * COIN;
/** Coinbase coins can only be spent this many blocks later (Bitcoin: 100). */
export const COINBASE_MATURITY = 6;
export const MAX_BLOCK_TXS = 64;
/** Target block interval, in simulated seconds (Bitcoin: 600). */
export const BLOCK_INTERVAL_S = 8;
/** Total hash attempts per simulated second across the default network. */
export const NETWORK_HASHRATE = 4_000;
/** A block may be at most this far ahead of the receiving node's clock (Bitcoin: 2 hours ≈ 12 blocks). */
export const MAX_FUTURE_S = 96;
/** A block's time must be greater than the median of the previous MTP_WINDOW blocks. */
export const MTP_WINDOW = 11;
/**
 * Fixed proof-of-work target: on average one hash in BLOCK_INTERVAL_S × NETWORK_HASHRATE
 * is low enough. Difficulty does not retarget — a deliberate v1 simplification (see /real).
 */
export const EXPECTED_ATTEMPTS = BLOCK_INTERVAL_S * NETWORK_HASHRATE;
export const DEFAULT_FEE = 100_000n; // 0.001 KAUDI

export const blockReward = (height: number) => {
  const halvings = Math.floor(height / HALVING_INTERVAL);
  return halvings >= 64 ? 0n : BLOCK_REWARD >> BigInt(halvings);
};
