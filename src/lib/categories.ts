import type { DictKey } from "@/lib/i18n/dict";

export const CATEGORIES = ["gateaux", "cuisine", "terroir", "couture", "enfants", "artisanat", "beaute", "bijoux"] as const;
export type Category = (typeof CATEGORIES)[number];

export const catKey = (c: string) => `cat_${c}` as DictKey;

/** Soft background tint per category, used behind icons and empty images. */
export const CAT_TINT: Record<string, string> = {
  gateaux: "bg-amber-100", cuisine: "bg-orange-100", terroir: "bg-lime-100", couture: "bg-rose-100",
  enfants: "bg-sky-100", artisanat: "bg-stone-200", beaute: "bg-fuchsia-100", bijoux: "bg-indigo-100",
};

export const HERO_IMAGE =
  "https://cdn.openart.ai/openart-ai/production/2026-11/create-image/MhvcIzM5LOm6TNPRGEXK/021793960479761651bcb683a664fec8e1b815c68d8e2de1aa4ab_0_1793960490037_330e1a75.jpeg";

export type ProductCardData = {
  id: string; name: string; price_dzd: number; image: string; category: string;
  shop_name: string; shop_slug: string; shop_wilaya: string;
};
