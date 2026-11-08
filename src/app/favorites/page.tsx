"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/useSession";
import type { ProductCardData } from "@/lib/categories";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicNav } from "@/components/PublicNav";
import { ProductGrid } from "@/components/ProductCard";
import { ShopLogo, type LogoConfig } from "@/components/ShopLogo";
import { FavoriteButton } from "@/components/FavoriteButton";
import { Icon } from "@/components/Icon";
import { Spinner } from "@/components/ui";

type FavShop = { id: string; name: string; slug: string; wilaya: string; logo?: LogoConfig; logo_url?: string; category?: string | null };

export default function FavoritesPage() {
  const { t } = useI18n();
  const user = useSession();
  const [data, setData] = useState<{ products: ProductCardData[]; shops: FavShop[] } | null>(null);

  useEffect(() => {
    if (user === null) { window.location.replace("/login?next=/favorites"); return; }
    if (!user) return;
    supabase().rpc("my_favorites").then(({ data }) => setData(data ?? { products: [], shops: [] }));
  }, [user]);

  const empty = data && !data.products.length && !data.shops.length;
  return (
    <div className="min-h-dvh bg-ivory">
      <PublicHeader />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-5">
        <h1 className="font-display text-3xl">{t("favorites")}</h1>
        {!data ? <div className="py-16 text-center"><Spinner /></div> : empty ? (
          <div className="py-16 text-center">
            <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gold-soft text-rose-600"><Icon name="heart" className="h-8 w-8" /></span>
            <p className="mx-auto max-w-xs text-muted">{t("favorites_empty")}</p>
            <Link href="/explore" className="mt-4 inline-block rounded-full bg-brand px-5 py-3 font-semibold text-white">{t("start_shopping")}</Link>
          </div>
        ) : (
          <>
            {data.shops.length ? (
              <section>
                <h2 className="mb-3 font-semibold">{t("fav_shops")}</h2>
                <div className="space-y-2">
                  {data.shops.map((s) => (
                    <Link key={s.id} href={`/s/${s.slug}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                      <ShopLogo name={s.name} logo={s.logo} logoUrl={s.logo_url} category={s.category} size={44} />
                      <span className="min-w-0 flex-1 truncate font-semibold">{s.name}</span>
                      <FavoriteButton kind="shop" id={s.id} size="sm" />
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
            {data.products.length ? (
              <section>
                <h2 className="mb-3 font-semibold">{t("fav_products")}</h2>
                <ProductGrid items={data.products} />
              </section>
            ) : null}
          </>
        )}
      </main>
      <PublicNav />
    </div>
  );
}
