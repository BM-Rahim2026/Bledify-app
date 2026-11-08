import type { DictKey } from "@/lib/i18n/dict";

// The 8 permanent categories (same list as the SQL check constraint).
export const CATEGORIES = ["food", "fashion", "crafts", "home", "terroir", "occasions", "beauty", "jewelry"] as const;
export type Category = (typeof CATEGORIES)[number];

// Offers (seasonal / special) live in the database: see src/lib/offers.ts.

// Subcategories per category (same list as public.subcategories_of() in SQL; a DB test checks it).
export const SUBCATEGORIES: Record<Category, readonly string[]> = {
  food: ["trad_cakes", "modern_cakes", "savory", "breads", "couscous_pasta", "dishes", "jams_sweets", "chocolate", "trays_boxes", "catering"],
  fashion: ["women_traditional", "modern_modest", "hijabs", "men", "kids_babies", "knitting", "shoes", "tailoring"],
  crafts: ["pottery", "copper", "embroidery", "weaving", "basketry", "leather", "wood", "calligraphy", "instruments"],
  home: ["rugs", "linens", "cushions", "tableware", "utensils", "lighting", "wall_decor", "candles_incense", "baskets_storage", "furniture"],
  terroir: ["olive_oil", "honey", "dates", "produce", "eggs", "dairy", "grains", "spices_herbs", "dried_fruits_nuts", "processed", "plants_seeds"],
  occasions: ["trousseau", "henna", "decorated_trays", "favors", "invitations", "event_decor", "birth_circumcision", "custom_gifts"],
  beauty: ["soaps", "oils", "face", "hair", "hammam_body", "perfumes", "khol_swak", "baby_mom", "men_beard", "gift_sets"],
  jewelry: ["silver_traditional", "fantasy", "beads_stones", "personalized", "bags", "hair_accessories", "belts", "small_accessories", "jewelry_boxes"],
};
export const subKey = (s: string) => `sub_${s}` as DictKey;

export const catKey = (c: string) => `cat_${c}` as DictKey;
export const catSubKey = (c: string) => `cat_${c}_sub` as DictKey;

const CDN = "https://cdn.openart.ai/openart-ai/production/2026-11/create-image/MhvcIzM5LOm6TNPRGEXK/";

/** Curated tile image per category (falls back to a product photo). */
export const CATEGORY_IMAGE: Record<Category, string> = {
  food: "/home/cat-food.webp",
  fashion: CDN + "021793960540823ceb2efb7fea58c55155fc9fb92515dcdc22234_0_1793960558396_835b4da2.jpeg",
  crafts: "/home/cat-crafts.webp",
  home: CDN + "0217939605758289aa9d0b0344e85196ac345634277259cf9e848_0_1793960582191_2297ec01.jpeg",
  terroir: CDN + "0217939608397643cb8a93f7287826a4278aac7f0d089f936dfed_0_1793960846705_aac1fbc9.jpeg",
  occasions: CDN + "0217940604268800958c43c09b2d8895d306984ebab65852238f8_0_1794060433346_7cdbed34.jpeg",
  beauty: CDN + "021794132841655fdccfc102ca12157f94275e78054dc3b3071be_0_1794132848694_40a305af.jpeg",
  jewelry: CDN + "02179414478470799b13dab45b2d10982c2cf34f4d4639da2e831_0_1794144791611_4118750e.jpeg",
};



export const HERO_SLIDES = [
  { image: "/home/hero-baskets.webp", title: "hero1_title", sub: "hero1_sub", href: "/explore" },
  { image: "/home/hero-kitchen.webp", title: "hero2_title", sub: "hero2_sub", href: "/explore?category=food" },
  { image: "/home/hero-rugs.webp", title: "hero3_title", sub: "hero3_sub", href: "/explore?category=home" },
] as const;

/** Soft background behind images while they load. */
export const CAT_TINT: Record<string, string> = {
  food: "bg-amber-100", fashion: "bg-rose-100", crafts: "bg-stone-200",
  home: "bg-orange-100", terroir: "bg-lime-100", occasions: "bg-yellow-50", beauty: "bg-pink-50", jewelry: "bg-amber-50",
};

// kept for the old hero image references
export const HERO_IMAGE = "/home/hero-baskets.webp";

export type ProductCardData = {
  id: string; name: string; price_dzd: number; image: string; category: string; tags?: string[];
  subcategory?: string | null;
  shop_id?: string; shop_name: string; shop_slug: string; shop_wilaya: string;
  shop_verified?: boolean; rating?: number | string | null; review_count?: number;
};
