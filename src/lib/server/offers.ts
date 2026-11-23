import "server-only";
import { cache } from "react";
import { serverSupabase } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/env";
import type { Offer } from "@/lib/offers";

/** Active offers, in display order (one query per request). */
export const getOffers = cache(async (): Promise<Offer[]> => {
  if (!isConfigured) return [];
  const { data } = await (await serverSupabase()).from("offers").select("*").eq("active", true).order("position");
  return (data ?? []) as Offer[];
});
