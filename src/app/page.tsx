import Image from "next/image";
import Link from "next/link";
import { anonSupabase } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/env";
import { getT } from "@/lib/i18n/server";
import { CATEGORIES, CAT_TINT, HERO_IMAGE, catKey, type ProductCardData } from "@/lib/categories";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicNav } from "@/components/PublicNav";
import { ProductGrid } from "@/components/ProductCard";
import { ShopCard, type ShopCardData } from "@/components/ShopCard";
import { SearchBox } from "@/components/SearchBox";

type Home = {
  categories: { slug: string; count: number; image: string | null }[];
  featured: ProductCardData[];
  shops: ShopCardData[];
};

async function getHome(): Promise<Home> {
  const empty = { categories: [], featured: [], shops: [] };
  if (!isConfigured) return empty;
  const { data } = await anonSupabase().rpc("public_home");
  return (data as Home) ?? empty;
}

export default async function HomePage() {
  const [{ t }, home] = await Promise.all([getT(), getHome()]);
  const catImage = Object.fromEntries(home.categories.map((c) => [c.slug, c.image]));
  const cats = CATEGORIES.filter((c) => home.categories.some((x) => x.slug === c));

  return (
    <div className="min-h-dvh">
      {/* hero */}
      <section className="relative isolate min-h-[88svh] overflow-hidden md:min-h-[640px]">
        <Image src={HERO_IMAGE} alt="" fill priority sizes="100vw" className="-z-10 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/55 via-black/35 to-black/75" />
        <PublicHeader overlay />
        <div className="mx-auto flex min-h-[88svh] max-w-6xl flex-col justify-end px-4 pb-12 pt-28 md:min-h-[640px] md:justify-center md:pb-16">
          <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            ✦ {t("why_handmade")} · {t("why_cod")}
          </span>
          <h1 className="max-w-2xl font-display text-[2.6rem] leading-[1.05] text-white drop-shadow md:text-6xl">{t("home_hero_title")}</h1>
          <p className="mt-4 max-w-xl text-base text-white/90 md:text-lg">{t("home_hero_sub")}</p>
          <div className="mt-7 max-w-xl"><SearchBox large /></div>
          <div className="mt-4 flex flex-wrap gap-2">
            {["gateaux", "couture", "terroir"].map((c) => (
              <Link key={c} href={`/explore?category=${c}`} className="rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20">
                {t(catKey(c))}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4">
        {/* categories */}
        {cats.length ? (
          <section className="relative z-10 -mt-8 rounded-3xl bg-surface p-4 shadow-lg ring-1 ring-line md:-mt-12 md:p-6">
            <h2 className="mb-4 font-display text-2xl">{t("categories")}</h2>
            <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-8 md:px-0">
              {cats.map((c) => (
                <Link key={c} href={`/explore?category=${c}`} className="group flex w-20 shrink-0 flex-col items-center gap-2 text-center md:w-auto">
                  <span className={`relative h-20 w-20 overflow-hidden rounded-full ring-2 ring-transparent transition group-hover:ring-brand ${CAT_TINT[c]}`}>
                    {catImage[c] ? <Image src={catImage[c]!} alt="" fill sizes="80px" className="object-cover" /> : null}
                  </span>
                  <span className="text-xs font-semibold leading-tight">{t(catKey(c))}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* featured */}
        {home.featured.length ? (
          <section className="mt-12">
            <div className="mb-5 flex items-end justify-between">
              <h2 className="font-display text-3xl">{t("featured")}</h2>
              <Link href="/explore" className="text-sm font-semibold text-brand">{t("see_all")} →</Link>
            </div>
            <ProductGrid items={home.featured.slice(0, 8)} />
          </section>
        ) : null}

        {/* shops */}
        {home.shops.length ? (
          <section className="mt-14">
            <h2 className="mb-5 font-display text-3xl">{t("shops_title")}</h2>
            <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-3">
              {home.shops.map((s) => <ShopCard key={s.slug} s={s} />)}
            </div>
          </section>
        ) : null}

        {/* why */}
        <section className="mt-12 grid gap-3 md:grid-cols-3">
          {[
            ["🏠", t("why_handmade"), t("why_handmade_sub")],
            ["💵", t("why_cod"), t("why_cod_sub")],
            ["🚚", t("why_wilayas"), t("why_wilayas_sub")],
          ].map(([icon, title, sub]) => (
            <div key={title} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-xl">{icon}</span>
              <div><p className="font-semibold">{title}</p><p className="text-sm text-muted">{sub}</p></div>
            </div>
          ))}
        </section>

        {/* more products */}
        {home.featured.length > 8 ? (
          <section className="mt-12"><ProductGrid items={home.featured.slice(8)} /></section>
        ) : null}

        {/* seller CTA */}
        <section className="relative mt-14 overflow-hidden rounded-3xl bg-ink px-6 py-10 text-white md:px-12 md:py-14">
          <div className="absolute -end-16 -top-16 h-64 w-64 rounded-full bg-brand/40 blur-3xl" />
          <div className="relative max-w-xl">
            <h2 className="font-display text-3xl md:text-4xl">{t("sell_title")}</h2>
            <p className="mt-3 text-white/80">{t("sell_sub")}</p>
            <Link href="/signup?role=seller" className="mt-6 inline-flex rounded-xl bg-brand px-5 py-3 font-semibold text-white hover:bg-brand-dark">{t("sell_cta")}</Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto mt-12 max-w-6xl px-4 pb-8 text-sm text-muted">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
          <span className="font-display text-xl text-brand">Bledify</span>
          <div className="flex gap-4">
            <Link href="/track">{t("track_order")}</Link>
            <Link href="/signup?role=seller">{t("sell_on_bledify")}</Link>
          </div>
        </div>
      </footer>
      <PublicNav />
    </div>
  );
}
