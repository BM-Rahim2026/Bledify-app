import Link from "next/link";
import type { Metadata } from "next";
import { anonSupabase } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/env";
import { getT } from "@/lib/i18n/server";
import { CATEGORIES, COLLECTIONS, catKey, colKey, type ProductCardData } from "@/lib/categories";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicNav } from "@/components/PublicNav";
import { ProductGrid } from "@/components/ProductCard";
import { SearchBox } from "@/components/SearchBox";

export const metadata: Metadata = { title: "Explorer" };
const PAGE = 24;

export default async function Explore({ searchParams }: PageProps<"/explore">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const category = CATEGORIES.includes(one(sp.category) as never) ? one(sp.category) : "";
  const q = one(sp.q).slice(0, 60);
  const collection = COLLECTIONS.includes(one(sp.collection) as never) ? one(sp.collection) : "";
  const limit = Math.min(PAGE * Math.max(1, parseInt(one(sp.n) || "1", 10) || 1), 120);
  const { t } = await getT();

  const items: ProductCardData[] = isConfigured
    ? ((await anonSupabase().rpc("public_products", { p_category: category || null, p_q: q || null, p_limit: limit + 1, p_offset: 0, p_tag: collection || null })).data ?? [])
    : [];
  const more = items.length > limit;

  const href = (c: string, col = collection) => {
    const p = new URLSearchParams();
    if (c) p.set("category", c);
    if (col) p.set("collection", col);
    if (q) p.set("q", q);
    return `/explore${p.size ? `?${p}` : ""}`;
  };

  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 py-5">
        <h1 className="mb-4 font-display text-3xl">{collection ? t(colKey(collection)) : category ? t(catKey(category)) : q ? t("results_for", { q }) : t("explore")}</h1>
        <SearchBox initial={q} category={category} />
        <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {["", ...CATEGORIES].map((c) => (
            <Link key={c || "all"} href={href(c)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${c === category ? "bg-ink text-white" : "border border-line bg-surface"}`}>
              {c ? t(catKey(c)) : t("all")}
            </Link>
          ))}
        </div>
        <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
          {COLLECTIONS.map((c) => (
            <Link key={c} href={href(category, c === collection ? "" : c)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${c === collection ? "border-gold bg-gold text-white" : "border-gold/50 bg-gold-soft/50 text-ink"}`}>
              {t(colKey(c))}
            </Link>
          ))}
        </div>
        <div className="mt-6">
          {items.length ? <ProductGrid items={items.slice(0, limit)} priorityCount={4} /> : (
            <p className="py-20 text-center text-muted">{t("no_results")}</p>
          )}
        </div>
        {more ? (
          <div className="mt-8 text-center">
            <Link href={`${href(category)}${href(category).includes("?") ? "&" : "?"}n=${Math.round(limit / PAGE) + 1}`} scroll={false}
              className="inline-block rounded-xl border border-line bg-surface px-5 py-2.5 font-semibold">{t("load_more")}</Link>
          </div>
        ) : null}
      </main>
      <PublicNav />
    </div>
  );
}
