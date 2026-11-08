// Delivery prices by zone. The zone list mirrors public.wilaya_zone() in SQL (a DB test checks it).
import type { DictKey } from "@/lib/i18n/dict";

export const ZONES = ["local", "nord", "hauts", "sud", "grand_sud"] as const;
export type Zone = (typeof ZONES)[number];
export type ZoneRate = { home: number; desk: number; days_min?: number; days_max?: number; off?: boolean };
export type DeliveryZones = Partial<Record<Zone, ZoneRate>>;
export type Quote = { zone: Zone; home: number; desk: number; days_min?: number; days_max?: number; off?: boolean };

// wilaya code -> zone (any code not listed is "nord")
export const ZONE_OF: Record<number, Exclude<Zone, "local" | "nord">> = {
  11: "grand_sud", 33: "grand_sud", 37: "grand_sud", 50: "grand_sud", 54: "grand_sud", 56: "grand_sud",
  1: "sud", 7: "sud", 8: "sud", 30: "sud", 39: "sud", 47: "sud", 49: "sud", 51: "sud", 52: "sud", 53: "sud", 55: "sud", 57: "sud", 58: "sud",
  3: "hauts", 4: "hauts", 5: "hauts", 12: "hauts", 14: "hauts", 17: "hauts", 19: "hauts", 20: "hauts", 28: "hauts", 32: "hauts", 34: "hauts", 38: "hauts", 40: "hauts", 45: "hauts",
};

export const wilayaCode = (v: string | null | undefined) => {
  const m = /^\s*(\d{1,2})/.exec(v ?? "");
  return m ? Number(m[1]) : null;
};

export function zoneOf(wilaya: string, shopWilaya?: string | null): Zone {
  const c = wilayaCode(wilaya);
  if (c == null) return "nord";
  if (c === wilayaCode(shopWilaya)) return "local";
  return ZONE_OF[c] ?? "nord";
}

type ShopFees = { wilaya?: string | null; delivery_home_dzd: number; delivery_desk_dzd: number; delivery_zones?: DeliveryZones | null };

/** Same result as public.delivery_quote() in SQL. */
export function quote(shop: ShopFees, wilaya: string): Quote {
  const zone = zoneOf(wilaya, shop.wilaya);
  const z = shop.delivery_zones?.[zone];
  if (!z) return { zone, home: shop.delivery_home_dzd, desk: shop.delivery_desk_dzd };
  return { ...z, zone };
}

/** Cheapest fee anywhere ("Livraison dès …"). */
export function minFee(shop: ShopFees): number {
  const z = Object.values(shop.delivery_zones ?? {}).filter((r) => r && !r.off) as ZoneRate[];
  if (!z.length) return Math.min(shop.delivery_home_dzd, shop.delivery_desk_dzd);
  return Math.min(...z.map((r) => Math.min(r.home, r.desk)));
}

export const zoneKey = (z: Zone) => `zone_${z}` as DictKey;

/** Default zone prices from flat fees (what a seller starts from). */
export function defaultZones(home: number, desk: number): Required<Record<Zone, ZoneRate>> {
  return {
    local: { home: Math.max(home - 200, 300), desk: Math.max(desk - 100, 200), days_min: 1, days_max: 2 },
    nord: { home, desk, days_min: 2, days_max: 3 },
    hauts: { home: home + 150, desk: desk + 100, days_min: 2, days_max: 4 },
    sud: { home: home + 350, desk: desk + 250, days_min: 3, days_max: 6 },
    grand_sud: { home: home + 700, desk: desk + 500, days_min: 5, days_max: 9 },
  };
}
