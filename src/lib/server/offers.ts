import "server-only";
import { cache } from "react";
import { anonSupabase } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/env";
import type { Offer } from "@/lib/offers";

/** Active offers, in display order (one query per request). */
export const getOffers = cache(async (): Promise<Offer[]> => {
  if (!isConfigured) return [];
  const { data } = await anonSupabase().from("offers").select("*").eq("active", true).order("position");
  return (data ?? []) as Offer[];
});
