import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { anonSupabase } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/env";
import { ShopView, type PublicShop } from "@/components/ShopView";
import { paymentMode } from "@/lib/server/payments";

const getShop = cache(async (slug: string): Promise<PublicShop | null> => {
  if (!isConfigured) return null;
  const { data } = await anonSupabase().rpc("get_public_shop", { p_slug: slug });
  return (data as PublicShop) ?? null;
});

export async function generateMetadata({ params }: PageProps<"/s/[slug]">): Promise<Metadata> {
  const shop = await getShop((await params).slug);
  if (!shop) return { title: "Bledify" };
  const image = shop.products.find((p) => p.images[0])?.images[0];
  return {
    title: shop.name,
    description: shop.description || `${shop.name} — paiement à la livraison`,
    openGraph: { title: shop.name, description: shop.description, images: image ? [image] : [] },
  };
}

export default async function ShopPage({ params }: PageProps<"/s/[slug]">) {
  const shop = await getShop((await params).slug);
  if (!shop) notFound();
  return <ShopView shop={shop} paymentsOn={paymentMode() !== "off"} />;
}
