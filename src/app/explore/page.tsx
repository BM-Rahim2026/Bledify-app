import Link from "next/link";
import type { Metadata } from "next";
import { anonSupabase } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/env";
import { getT } from "@/lib/i18n/server";
import { CATEGORIES, SUBCATEGORIES, catKey, subKey, type Category, type ProductCardData } from "@/lib/categories";
import { getOffers } from "@/lib/server/offers";
import { offerTitle } from "@/lib/offers";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicNav } from "@/components/PublicNav";
import { ProductGrid } from "@/components/ProductCard";
import { SearchBox } from "@/components/SearchBox";
import { SubcategorySelect } from "@/components/explore/SubcategorySelect";
import { SellerResults, type SellerResult } from "@/components/explore/SellerResults";

export const metadata: Metadata = { title: "Explorer" };
const PAGE = 24;

export default async function Explore({ searchParams }: PageProps<"/explore">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const category = CATEGORIES.includes(one(sp.category) as never) ? one(sp.category) : "";
  const q = one(sp.q).slice(0, 60);
  const subs = category ? SUBCATEGORIES[category as Category] : [];
  const sub = subs.includes(one(sp.sub)) ? one(sp.sub) : "";
  // with a subcategory, results are grouped by shop unless "all products" is chosen
  const view = sub && one(sp.view) !== "products" ? "shops" : "products";
  const offers = await getOffers();
  const offer = offers.find((o) => o.slug === one(sp.collection));
  const collection = offer ? offer.slug : "";
  const limit = Math.min(PAGE * Math.max(1, parseInt(one(sp.n) || "1", 10) || 1), 120);
  const { t, lang } = await getT();

  const sellers: SellerResult[] = isConfigured && view === "shops"
    ? ((await anonSupabase().rpc("public_sellers", { p_category: category, p_sub: sub, p_tag: collection || null, p_q: q || null })).data ?? [])
    : [];
  const items: ProductCardData[] = isConfigured && view === "products"
    ? ((await anonSupabase().rpc("public_products", { p_category: category || null, p_q: q || null, p_limit: limit + 1, p_offset: 0, p_tag: collection || null, p_sub: sub || null })).data ?? [])
    : [];
  const counts: Record<string, number> = isConfigured && category
    ? ((await anonSupabase().rpc("subcategory_counts", { p_category: category })).data ?? {}) : {};
  // subcategories with products first, then the others (still clickable)
  const subOrder = [...subs].sort((a, b) => Number(!counts[a]) - Number(!counts[b]));
  const more = items.length > limit;

  const href = (c: string, col = collection, s = "", v = "") => {
    const p = new URLSearchParams();
    if (c) p.set("category", c);
    if (c && s) p.set("sub", s);
    if (c && s && v) p.set("view", v);
    if (col) p.set("collection", col);
    if (q) p.set("q", q);
    return `/explore${p.size ? `?${p}` : ""}`;
  };

  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 py-5">
        <h1 className="mb-4 font-display text-3xl">{offer ? offerTitle(offer, lang) : sub ? t(subKey(sub)) : category ? t(catKey(category)) : q ? t("results_for", { q }) : t("explore")}</h1>
        {sub ? <Link href={href(category)} className="-mt-3 mb-3 inline-block text-sm font-semibold text-brand">{t(catKey(category))}</Link> : null}
        <SearchBox initial={q} category={category} />
        <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {["", ...(category ? [category] : []), ...CATEGORIES.filter((c) => c !== category)].map((c) => (
            <Link key={c || "all"} href={href(c)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${c === category ? "bg-ink text-white" : "border border-line bg-surface"}`}>
              {c ? t(catKey(c)) : t("all")}
            </Link>
          ))}
        </div>
        {subs.length ? (
          <SubcategorySelect value={sub}
            options={subOrder.map((k) => ({ key: k, label: t(subKey(k)), count: counts[k] ?? 0 }))}
            hrefFor={Object.fromEntries([["", href(category)], ...subs.map((k) => [k, href(category, collection, k)])])} />
        ) : null}
        {sub ? (
          <div className="mt-3 inline-flex rounded-full border border-line bg-surface p-0.5 text-sm font-semibold">
            <Link href={href(category, collection, sub)} className={`rounded-full px-3 py-1 ${view === "shops" ? "bg-brand text-white" : "text-muted"}`}>{t("view_by_shop")}</Link>
            <Link href={href(category, collection, sub, "products")} className={`rounded-full px-3 py-1 ${view === "products" ? "bg-brand text-white" : "text-muted"}`}>{t("view_all_products")}</Link>
          </div>
        ) : null}
        <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
          {offers.map((o) => o.slug).map((c) => (
            <Link key={c} href={href(category, c === collection ? "" : c)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${c === collection ? "border-gold bg-gold text-white" : "border-gold/50 bg-gold-soft/50 text-ink"}`}>
              {offerTitle(offers.find((o) => o.slug === c)!, lang)}
            </Link>
          ))}
        </div>
        <div className="mt-6">
          {view === "shops" ? <SellerResults sellers={sellers} /> : items.length ? <ProductGrid items={items.slice(0, limit)} priorityCount={4} /> : (
            <p className="py-20 text-center text-muted">{t("no_results")}</p>
          )}
        </div>
        {more ? (
          <div className="mt-8 text-center">
            <Link href={`${href(category, collection, sub)}${href(category, collection, sub).includes("?") ? "&" : "?"}n=${Math.round(limit / PAGE) + 1}`} scroll={false}
              className="inline-block rounded-xl border border-line bg-surface px-5 py-2.5 font-semibold">{t("load_more")}</Link>
          </div>
        ) : null}
      </main>
      <PublicNav />
    </div>
  );
}
