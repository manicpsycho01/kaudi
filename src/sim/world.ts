/**
 * The sea: trading ports that cowries actually moved between, and the lanes joining them.
 * Positions are real (lon/lat); latency is schematic — proportional to sea distance, scaled so a block
 * takes 0.3–1.2 simulated seconds per hop. That delay is what makes forks happen.
 */
export type PortId = "zanzibar" | "aden" | "socotra" | "surat" | "calicut" | "male" | "kolkata" | "malacca";
export const PORTS: { id: PortId; name: string; lon: number; lat: number; hashrate: number; note: string }[] = [
  { id: "zanzibar", name: "Zanzibar", lon: 39.19, lat: -6.16, hashrate: 400, note: "Swahili coast" },
  { id: "aden", name: "Aden", lon: 45.03, lat: 12.8, hashrate: 600, note: "Gate of the Red Sea" },
  { id: "socotra", name: "Socotra", lon: 53.85, lat: 12.5, hashrate: 0, note: "A corsair's island — mines only when you arm it" },
  { id: "surat", name: "Surat", lon: 72.83, lat: 21.17, hashrate: 700, note: "Mughal India's great port" },
  { id: "calicut", name: "Calicut", lon: 75.78, lat: 11.25, hashrate: 700, note: "The pepper coast" },
  { id: "male", name: "Malé", lon: 73.51, lat: 4.18, hashrate: 300, note: "Where the cowries came from" },
  { id: "kolkata", name: "Kolkata", lon: 88.36, lat: 22.57, hashrate: 700, note: "Cowries were small change in Bengal into the 1800s" },
  { id: "malacca", name: "Malacca", lon: 102.25, lat: 2.19, hashrate: 600, note: "The strait to the east" },
];
export const ROUTES: [PortId, PortId][] = [
  ["zanzibar", "aden"], ["zanzibar", "male"], ["aden", "socotra"], ["aden", "surat"], ["socotra", "calicut"],
  ["surat", "calicut"], ["calicut", "male"], ["calicut", "kolkata"], ["male", "malacca"], ["kolkata", "malacca"], ["aden", "calicut"],
];
/** The monsoon splits the sea into these two halves. */
export const WEST: PortId[] = ["zanzibar", "aden", "socotra"];

const R = 6371;
export function distanceKm(a: PortId, b: PortId) {
  const p = PORTS.find((x) => x.id === a)!, q = PORTS.find((x) => x.id === b)!;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(q.lat - p.lat), dLon = toRad(q.lon - p.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(p.lat)) * Math.cos(toRad(q.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h)) * 1.15; // ships don't sail great circles
}
/** Simulated milliseconds for a message to cross a lane. */
export const latencyMs = (a: PortId, b: PortId) => Math.round(150 + distanceKm(a, b) * 0.22);
export const routeKey = (a: string, b: string) => [a, b].sort().join("|");
