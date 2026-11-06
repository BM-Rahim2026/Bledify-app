import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { anonSupabase } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/env";
import { ProductView, type PublicProduct } from "@/components/ProductView";

const UUID = /^[0-9a-f-]{36}$/i;

const getProduct = cache(async (id: string): Promise<PublicProduct | null> => {
  if (!isConfigured || !UUID.test(id)) return null;
  const { data } = await anonSupabase().rpc("public_product", { p_id: id });
  return (data as PublicProduct) ?? null;
});

export async function generateMetadata({ params }: PageProps<"/p/[id]">): Promise<Metadata> {
  const p = await getProduct((await params).id);
  if (!p) return { title: "Bledify" };
  return {
    title: p.name,
    description: `${p.shop.name} — ${p.description}`.slice(0, 160),
    openGraph: { title: p.name, description: p.description, images: p.images[0] ? [p.images[0]] : [] },
  };
}

export default async function ProductPage({ params }: PageProps<"/p/[id]">) {
  const p = await getProduct((await params).id);
  if (!p) notFound();
  return <ProductView p={p} />;
}
