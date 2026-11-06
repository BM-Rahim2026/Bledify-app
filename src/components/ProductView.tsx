"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { addToCart } from "@/lib/cart";
import { CAT_TINT, catKey, type ProductCardData } from "@/lib/categories";
import { wilayaLabel } from "@/lib/wilayas";
import { PublicHeader } from "@/components/PublicHeader";
import { ProductGrid } from "@/components/ProductCard";
import { Button } from "@/components/ui";

export type PublicProduct = {
  id: string; name: string; description: string; price_dzd: number; images: string[]; category: string;
  shop: { name: string; slug: string; wilaya: string; description: string; delivery_home_dzd: number; delivery_desk_dzd: number; delivered_count: number };
  related: ProductCardData[];
};

export function ProductView({ p }: { p: PublicProduct }) {
  const { t, lang, formatDZD } = useI18n();
  const router = useRouter();
  const [img, setImg] = useState(0);
  const [qty, setQty] = useState(1);

  function order() {
    addToCart(p.shop.slug, p.id, qty);
    router.push(`/s/${p.shop.slug}#order`);
  }

  return (
    <div className="min-h-dvh pb-28 md:pb-10">
      <PublicHeader />
      <main className="mx-auto max-w-6xl md:grid md:grid-cols-2 md:gap-10 md:px-4 md:py-8">
        <div>
          <div className={`relative aspect-square overflow-hidden md:rounded-3xl ${CAT_TINT[p.category] ?? "bg-stone-100"}`}>
            {p.images[img] ? <Image src={p.images[img]} alt={p.name} fill priority sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" /> : null}
          </div>
          {p.images.length > 1 ? (
            <div className="flex gap-2 px-4 pt-3 md:px-0">
              {p.images.map((src, i) => (
                <button key={src} onClick={() => setImg(i)} className={`relative h-16 w-16 overflow-hidden rounded-xl ring-2 ${i === img ? "ring-brand" : "ring-transparent"}`}>
                  <Image src={src} alt="" fill sizes="64px" className="object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="px-4 pt-5 md:px-0 md:pt-0">
          <Link href={`/explore?category=${p.category}`} className="text-sm font-semibold text-brand">{t(catKey(p.category))}</Link>
          <h1 className="mt-1 font-display text-3xl leading-tight md:text-4xl">{p.name}</h1>
          <p className="mt-3 text-3xl font-bold text-brand">{formatDZD(p.price_dzd)}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-brand-soft px-2.5 py-1 text-brand">🏠 {t("handmade")}</span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-ok">💵 {t("cod")}</span>
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-muted">🚚 {t("delivery_from", { price: formatDZD(Math.min(p.shop.delivery_desk_dzd, p.shop.delivery_home_dzd)) })}</span>
          </div>
          {p.description ? <p className="mt-5 whitespace-pre-line leading-relaxed text-ink/90">{p.description}</p> : null}

          <div className="mt-6 hidden items-center gap-3 md:flex">
            <Qty qty={qty} setQty={setQty} />
            <Button className="flex-1 text-lg" onClick={order}>{t("order_this")} · {formatDZD(p.price_dzd * qty)}</Button>
          </div>

          <Link href={`/s/${p.shop.slug}`} className="mt-6 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:shadow-sm">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand font-display text-xl text-white">
              {p.shop.name.replace(/^(Les|La|Le|L'|Dar|Atelier)\s+/i, "")[0]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">{t("sold_by")}</p>
              <p className="truncate font-semibold">{p.shop.name}</p>
              <p className="text-xs text-muted">
                {wilayaLabel(p.shop.wilaya, lang).replace(/^\d+ - /, "")}
                {p.shop.delivered_count ? ` · ✓ ${t("delivered_count", { n: p.shop.delivered_count })}` : ""}
              </p>
            </div>
            <span className="text-sm font-semibold text-brand">{t("view_shop")} →</span>
          </Link>
        </div>
      </main>

      {p.related.length ? (
        <section className="mx-auto mt-10 max-w-6xl px-4">
          <h2 className="mb-4 font-display text-2xl">{t("more_from_shop")}</h2>
          <ProductGrid items={p.related} />
        </section>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-line bg-surface/95 p-3 backdrop-blur md:hidden">
        <Qty qty={qty} setQty={setQty} />
        <Button className="min-w-0 flex-1 whitespace-nowrap px-3" onClick={order}>
          {t("order_this")}<span className="opacity-80">·</span>{formatDZD(p.price_dzd * qty)}
        </Button>
      </div>
    </div>
  );
}

function Qty({ qty, setQty }: { qty: number; setQty: (n: number) => void }) {
  return (
    <div className="flex items-center rounded-xl border border-line bg-surface">
      <button type="button" className="px-3 py-2.5 text-lg" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="-">−</button>
      <span className="w-6 text-center font-bold">{qty}</span>
      <button type="button" className="px-3 py-2.5 text-lg" onClick={() => setQty(Math.min(99, qty + 1))} aria-label="+">+</button>
    </div>
  );
}
