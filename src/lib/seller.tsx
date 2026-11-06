"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";

export type Shop = {
  id: string; owner_id: string; name: string; slug: string; description: string;
  phone: string; whatsapp: string; wilaya: string;
  delivery_home_dzd: number; delivery_desk_dzd: number;
  notify_email: string; notify_new_orders: boolean; created_at: string;
};

type Ctx = { user: User; shop: Shop | null; reloadShop: () => Promise<void> };
const SellerContext = createContext<Ctx | null>(null);

export function SellerProvider({ children, fallback, onboarding }: {
  children: React.ReactNode;
  fallback: React.ReactNode;
  onboarding: (user: User, done: () => Promise<void>) => React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [shop, setShop] = useState<Shop | null | undefined>(undefined);
  const { lang, setLang } = useI18n();

  const reloadShop = useCallback(async () => {
    const { data } = await supabase().from("shops").select("*").maybeSingle();
    setShop((data as Shop) ?? null);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase().auth.getUser();
      if (!alive) return;
      if (!data.user) { window.location.href = "/login"; return; }
      setUser(data.user);
      const saved = data.user.user_metadata?.language;
      if ((saved === "fr" || saved === "ar") && saved !== lang && !document.cookie.includes("lang=")) setLang(saved);
      await reloadShop();
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadShop]);

  if (!user || shop === undefined) return <>{fallback}</>;
  if (!shop) return <>{onboarding(user, reloadShop)}</>;
  return <SellerContext.Provider value={{ user, shop, reloadShop }}>{children}</SellerContext.Provider>;
}

export function useSeller() {
  const c = useContext(SellerContext);
  if (!c || !c.shop) throw new Error("useSeller outside SellerProvider");
  return { ...c, shop: c.shop };
}

export function shopUrl(slug: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base.replace(/\/$/, "")}/s/${slug}`;
}
