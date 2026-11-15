import type { PortId } from "@/sim/world";
/** Two-letter codes used on block tiles and small screens. */
export const CODE: Record<PortId, string> = { zanzibar: "ZN", aden: "AD", socotra: "SO", surat: "SU", calicut: "CA", male: "ML", kolkata: "KO", malacca: "MA" };
export const NAME: Record<PortId, string> = { zanzibar: "Zanzibar", aden: "Aden", socotra: "Socotra", surat: "Surat", calicut: "Calicut", male: "Malé", kolkata: "Kolkata", malacca: "Malacca" };
/** Where each port's label sits relative to its dot, chosen so no label covers a lane or another port. */
export const LABEL: Record<PortId, { dx: number; dy: number; anchor: "start" | "middle" | "end" }> = {
  zanzibar: { dx: 16, dy: 5, anchor: "start" },
  aden: { dx: -4, dy: 30, anchor: "middle" },
  socotra: { dx: 0, dy: 32, anchor: "middle" },
  surat: { dx: -16, dy: 5, anchor: "end" },
  calicut: { dx: 16, dy: 5, anchor: "start" },
  male: { dx: -16, dy: 5, anchor: "end" },
  kolkata: { dx: 16, dy: 5, anchor: "start" },
  malacca: { dx: -16, dy: 22, anchor: "end" },
};
export const minerName = (m: string) => (m in NAME ? NAME[m as PortId] : m === "genesis" ? "Genesis" : "Unknown");
export const minerCode = (m: string) => (m in CODE ? CODE[m as PortId] : m === "genesis" ? "GN" : "??");
