import { WILAYA_COORDS } from "@/lib/geo-coords";

/** Where the person is: a wilaya code, and how we know it. */
export type Loc = { code: number; source: "gps" | "manual" | "ip" };

export const LOC_COOKIE = "loc";

/** Cookie value "31.gps" → {code: 31, source: "gps"}. */
export function parseLoc(v: string | undefined | null): Loc | null {
  const m = /^(\d{1,2})\.(gps|manual|ip)$/.exec(v ?? "");
  if (!m) return null;
  const code = Number(m[1]);
  return WILAYA_COORDS[code] ? { code, source: m[2] as Loc["source"] } : null;
}
export const formatLoc = (l: Loc) => `${l.code}.${l.source}`;

/** Great-circle distance in km (same formula as SQL wilaya_km). */
export function distanceKm(a: [number, number], b: [number, number]): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)));
}

/** Wilaya whose capital is nearest to a GPS position (close enough to sort shops; can be changed by hand). */
export function nearestWilaya(lat: number, lng: number): number {
  let best = 16, min = Infinity;
  for (const [code, c] of Object.entries(WILAYA_COORDS)) {
    const d = distanceKm([lat, lng], c);
    if (d < min) { min = d; best = Number(code); }
  }
  return best;
}
