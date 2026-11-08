"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { isConfigured } from "@/lib/env";

// Favourite products and shops of the signed-in user, loaded once and shared by every heart button.
type Favs = { products: Set<string>; shops: Set<string> };
let cache: Favs | null = null;
let loading: Promise<Favs> | null = null;
const listeners = new Set<() => void>();

async function load(): Promise<Favs> {
  if (cache) return cache;
  loading ??= (async () => {
    const empty = { products: new Set<string>(), shops: new Set<string>() };
    if (!isConfigured) return empty;
    const { data: u } = await supabase().auth.getUser();
    if (!u.user) return empty;
    const { data } = await supabase().from("favorites").select("product_id, shop_id");
    for (const r of data ?? []) {
      if (r.product_id) empty.products.add(r.product_id);
      if (r.shop_id) empty.shops.add(r.shop_id);
    }
    return empty;
  })();
  cache = await loading;
  return cache;
}

export function useFavorite(kind: "product" | "shop", id: string) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    const sync = () => load().then((f) => alive && setOn((kind === "product" ? f.products : f.shops).has(id)));
    sync();
    listeners.add(sync);
    return () => { alive = false; listeners.delete(sync); };
  }, [kind, id]);
  return on;
}

/** Toggles a favourite; returns false when the user must sign in first. */
export async function toggleFavorite(kind: "product" | "shop", id: string): Promise<boolean> {
  const { data: u } = await supabase().auth.getUser();
  if (!u.user) return false;
  const f = await load();
  const set = kind === "product" ? f.products : f.shops;
  const col = kind === "product" ? "product_id" : "shop_id";
  if (set.has(id)) {
    set.delete(id);
    listeners.forEach((l) => l());
    await supabase().from("favorites").delete().eq(col, id);
  } else {
    set.add(id);
    listeners.forEach((l) => l());
    await supabase().from("favorites").insert(kind === "product" ? { product_id: id } : { shop_id: id });
  }
  return true;
}
