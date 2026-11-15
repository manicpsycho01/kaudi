import { makeGenesis } from "./block";
import { keypairFromSeed } from "./keys";
import { COIN } from "./params";

/** The demo wallets. Their keys are derived from public seeds — fine for a simulator, never for real money. */
export const PEOPLE = [
  { id: "asha", name: "Asha", home: "surat" },
  { id: "bilal", name: "Bilal", home: "aden" },
  { id: "chen", name: "Chen", home: "malacca" },
  { id: "dara", name: "Dara", home: "calicut" },
  { id: "esi", name: "Esi", home: "zanzibar" },
  { id: "farah", name: "Farah", home: "kolkata" },
  { id: "ilyas", name: "Ilyas", home: "male" },
  { id: "corsair", name: "The Corsair", home: "aden" },
] as const;
export type PersonId = (typeof PEOPLE)[number]["id"];
export const personKey = (id: string) => keypairFromSeed("person/" + id);
export const GENESIS_ALLOC = PEOPLE.map((p) => ({ pkh: personKey(p.id).pkh, amount: 100n * COIN }));
export const GENESIS = makeGenesis(GENESIS_ALLOC);
