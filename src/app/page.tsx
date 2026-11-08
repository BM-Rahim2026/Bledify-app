import Link from "next/link";
import { anonSupabase } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/env";
import { getT } from "@/lib/i18n/server";
import type { ProductCardData } from "@/lib/categories";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicNav } from "@/components/PublicNav";
import { ProductRow } from "@/components/ProductCard";
import { ShopCard, type ShopCardData } from "@/components/ShopCard";
import { Logo } from "@/components/Logo";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { CategoryGrid, OffersSections, SectionTitle, TrustStrip } from "@/components/home/Sections";
import { getOffers } from "@/lib/server/offers";

type Home = { categories: { slug: string; image: string | null }[]; featured: ProductCardData[]; shops: ShopCardData[] };

async function getHome(): Promise<Home> {
  const empty = { categories: [], featured: [], shops: [] };
  if (!isConfigured) return empty;
  const { data } = await anonSupabase().rpc("public_home");
  return (data as Home) ?? empty;
}

export default async function HomePage() {
  const [{ t }, home, offers] = await Promise.all([getT(), getHome(), getOffers()]);
  const fallback = Object.fromEntries(home.categories.map((c) => [c.slug, c.image]));

  return (
    <div className="min-h-dvh bg-ivory">
      <PublicHeader tagline />
      <div className="mx-auto max-w-6xl md:px-4 md:pt-4"><HeroCarousel /></div>

      <main className="mx-auto max-w-6xl space-y-9 px-4 pt-7">
        <section>
          <SectionTitle title={t("shop_by_category")} href="/categories" linkLabel={t("see_all")} />
          <CategoryGrid fallback={fallback} />
        </section>

        <OffersSections offers={offers} />

        <TrustStrip />

        {home.featured.length ? (
          <section>
            <SectionTitle title={t("our_picks")} href="/explore" linkLabel={t("see_all")} />
            <ProductRow items={home.featured} />
          </section>
        ) : null}

        {home.shops.length ? (
          <section>
            <SectionTitle title={t("shops_title")} />
            <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-3">
              {home.shops.map((s) => <ShopCard key={s.slug} s={s} />)}
            </div>
          </section>
        ) : null}

        <section className="relative overflow-hidden rounded-3xl bg-brand px-6 py-9 text-white md:px-12 md:py-12">
          <div className="absolute -end-16 -top-16 h-64 w-64 rounded-full bg-gold/40 blur-3xl" />
          <div className="relative max-w-xl">
            <h2 className="font-display text-3xl md:text-4xl">{t("sell_title")}</h2>
            <p className="mt-3 text-white/85">{t("sell_sub")}</p>
            <Link href="/signup?role=seller" className="mt-6 inline-flex rounded-full bg-white px-5 py-3 font-semibold text-brand hover:bg-gold-soft">{t("sell_cta")}</Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto mt-10 max-w-6xl px-4 pb-8 text-sm text-muted">
        <div className="flex flex-col items-center gap-3 border-t border-line pt-6 text-center">
          <Logo height={28} />
          <p className="text-gold">{t("tagline_short")}</p>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            <Link href="/track">{t("track_order")}</Link>
            <Link href="/signup?role=seller">{t("sell_on_bledify")}</Link>
            <Link href="/confiance">{t("trust_title")}</Link>
          </div>
        </div>
      </footer>
      <PublicNav />
    </div>
  );
}
