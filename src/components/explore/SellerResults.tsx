"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { wilayaLabel } from "@/lib/wilayas";
import type { ProductCardData } from "@/lib/categories";
import { ShopLogo, type LogoConfig } from "@/components/ShopLogo";
import { ProductRow } from "@/components/ProductCard";
import { RatingSummary, VerifiedBadge } from "@/components/trust/Trust";
import { FavoriteButton } from "@/components/FavoriteButton";

export type SellerResult = {
  id: string; name: string; slug: string; wilaya: string; verified: boolean; distance_km?: number | null; logo?: LogoConfig; logo_url?: string;
  category?: string | null; delivered_count: number; product_count: number; rating?: number | string | null; review_count?: number;
  products: ProductCardData[];
};

/** Shops selling in the chosen (sub)category, each with its matching products. */
export function SellerResults({ sellers }: { sellers: SellerResult[] }) {
  const { t, lang } = useI18n();
  if (!sellers.length) return <p className="py-20 text-center text-muted">{t("no_results")}</p>;
  return (
    <div className="space-y-6">
      <p className="text-sm font-semibold text-muted">{sellers.length === 1 ? t("sellers_count_one") : t("sellers_count", { n: sellers.length })}</p>
      {sellers.map((s) => (
        <section key={s.id} className="rounded-2xl border border-line bg-surface p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <Link href={`/s/${s.slug}`} className="shrink-0">
              <ShopLogo name={s.name} logo={s.logo} logoUrl={s.logo_url} category={s.category} size={52} />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/s/${s.slug}`} className="flex items-center gap-1.5 font-semibold">
                <span className="truncate">{s.name}</span>{s.verified ? <VerifiedBadge compact /> : null}
              </Link>
              <p className="truncate text-xs text-muted">
                {wilayaLabel(s.wilaya, lang).replace(/^\d+ - /, "")}{s.distance_km != null ? ` (${s.distance_km < 15 ? t("dist_same") : t("dist_km", { n: s.distance_km })})` : ""} · {s.product_count === 1 ? t("products_count_one") : t("products_count", { n: s.product_count })}
                {s.delivered_count ? ` · ✓ ${t("delivered_count", { n: s.delivered_count })}` : ""}
              </p>
              <RatingSummary rating={s.rating} count={s.review_count} />
            </div>
            <FavoriteButton kind="shop" id={s.id} size="sm" />
          </div>
          <ProductRow items={s.products} inset="-mx-3 px-3" />
          <Link href={`/s/${s.slug}`} className="mt-1 inline-block text-sm font-semibold text-brand">{t("view_shop")} →</Link>
        </section>
      ))}
    </div>
  );
}
