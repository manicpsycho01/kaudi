/** Where the real KDI coin lives. `address` is null until it's deployed (scripts/deploy-coin.ts in the Kuri repo). */
export const COIN = {
  chainId: 84532,
  chainName: "Base Sepolia",
  rpc: "https://sepolia.base.org",
  explorer: "https://base-sepolia.blockscout.com",
  address: "0x42a5833879ef945e053184e29b579c33075c0c4a" as `0x${string}` | null,
  deployBlock: 59637772,
  source: "https://github.com/manicpsycho01/kuri/blob/main/contracts/KaudiCoin.sol",
};
