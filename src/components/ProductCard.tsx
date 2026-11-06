"use client";
import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { CAT_TINT, type ProductCardData } from "@/lib/categories";
import { wilayaLabel } from "@/lib/wilayas";

export function ProductCard({ p, priority = false }: { p: ProductCardData; priority?: boolean }) {
  const { lang, formatDZD } = useI18n();
  return (
    <Link href={`/p/${p.id}`} className="group block">
      <div className={`relative aspect-square overflow-hidden rounded-2xl ${CAT_TINT[p.category] ?? "bg-stone-100"}`}>
        {p.image ? (
          <Image src={p.image} alt={p.name} fill priority={priority} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition duration-500 group-hover:scale-105" />
        ) : null}
      </div>
      <div className="px-0.5 pt-2.5">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{p.name}</p>
        <p className="mt-1 text-base font-bold text-brand">{formatDZD(p.price_dzd)}</p>
        <p className="mt-0.5 truncate text-xs text-muted">{p.shop_name} · {wilayaLabel(p.shop_wilaya, lang).replace(/^\d+ - /, "")}</p>
      </div>
    </Link>
  );
}

export function ProductGrid({ items, priorityCount = 0 }: { items: ProductCardData[]; priorityCount?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((p, i) => <ProductCard key={p.id} p={p} priority={i < priorityCount} />)}
    </div>
  );
}
