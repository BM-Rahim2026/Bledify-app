"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { addToCart } from "@/lib/cart";
import { CAT_TINT, type ProductCardData } from "@/lib/categories";
import { wilayaLabel } from "@/lib/wilayas";
import { FavoriteButton } from "@/components/FavoriteButton";
import { Icon } from "@/components/Icon";
import { RatingSummary, VerifiedBadge } from "@/components/trust/Trust";

/** Product tile: photo, ♥, name, price, maker, wilaya and "add to cart". */
export function ProductCard({ p, priority = false }: { p: ProductCardData; priority?: boolean }) {
  const { t, lang, formatDZD } = useI18n();
  const [added, setAdded] = useState(false);
  const wilaya = wilayaLabel(p.shop_wilaya, lang).replace(/^\d+ - /, "");

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <Link href={`/p/${p.id}`} className={`relative block aspect-square overflow-hidden ${CAT_TINT[p.category] ?? "bg-stone-100"}`}>
        {p.image ? (
          <Image src={p.image} alt={p.name} fill priority={priority} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition duration-500 group-hover:scale-105" />
        ) : null}
        <FavoriteButton kind="product" id={p.id} size="sm" className="absolute end-2 top-2" />
      </Link>
      <div className="flex flex-1 flex-col p-2.5">
        <Link href={`/p/${p.id}`} className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{p.name}</Link>
        <p className="mt-1 text-base font-bold text-brand">{formatDZD(p.price_dzd)}</p>
        {p.review_count ? <RatingSummary rating={p.rating} count={p.review_count} compact /> : null}
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted"><span className="truncate">{t("by_maker", { name: p.shop_name })}</span>{p.shop_verified ? <VerifiedBadge compact /> : null}</p>
        <p className="mb-2 flex items-center gap-1 truncate text-xs text-muted"><Icon name="map" className="h-3.5 w-3.5 shrink-0 text-gold" />{wilaya}</p>
        <button
          type="button"
          onClick={() => { addToCart(p.shop_slug, p.id); setAdded(true); setTimeout(() => setAdded(false), 1600); }}
          className={`mt-auto inline-flex min-h-9 items-center justify-center gap-1 rounded-xl px-1.5 py-1.5 text-[12.5px] font-semibold leading-tight transition ${added ? "bg-ok text-white" : "bg-brand text-white hover:bg-brand-dark"}`}
        >
          <Icon name={added ? "check" : "cart"} className="h-4 w-4 shrink-0" />
          <span>{added ? t("added") : t("add_to_cart_long")}</span>
        </button>
      </div>
    </div>
  );
}

export function ProductGrid({ items, priorityCount = 0 }: { items: ProductCardData[]; priorityCount?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((p, i) => <ProductCard key={p.id} p={p} priority={i < priorityCount} />)}
    </div>
  );
}

/** Horizontal row of product tiles (home page "Nos choix"). */
export function ProductRow({ items, inset = "-mx-4 px-4" }: { items: ProductCardData[]; inset?: string }) {
  return (
    <div className={`no-scrollbar flex snap-x gap-3 overflow-x-auto pb-2 ${inset}`}>
      {items.map((p) => <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-56"><ProductCard p={p} /></div>)}
    </div>
  );
}
