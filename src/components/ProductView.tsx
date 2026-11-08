"use client";
import Image from "next/image";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { addToCart } from "@/lib/cart";
import { CAT_TINT, catKey, subKey, type ProductCardData } from "@/lib/categories";
import { wilayaLabel } from "@/lib/wilayas";
import { PublicHeader } from "@/components/PublicHeader";
import { ProductGrid } from "@/components/ProductCard";
import { Button } from "@/components/ui";
import { ShopLogo, type LogoConfig } from "@/components/ShopLogo";
import { FavoriteButton } from "@/components/FavoriteButton";
import { offerTitle, type Offer } from "@/lib/offers";
import { minFee, type DeliveryZones } from "@/lib/delivery";
import { RatingSummary, ReviewList, VerifiedBadge, type Review } from "@/components/trust/Trust";

export type PublicProduct = {
  id: string; name: string; description: string; story?: string; tags?: string[]; price_dzd: number; images: string[]; category: string;
  pay_cod?: boolean; pay_card?: boolean; deposit_pct?: number; subcategory?: string | null;
  shop: {
    name: string; slug: string; wilaya: string; description: string; delivery_home_dzd: number; delivery_desk_dzd: number;
    delivered_count: number; logo?: LogoConfig; logo_url?: string; category?: string | null;
    delivery_zones?: DeliveryZones | null; verified?: boolean; rating?: number | string | null; review_count?: number;
  };
  related: ProductCardData[];
  reviews?: Review[]; rating?: number | string | null; review_count?: number;
};

export function ProductView({ p, offers = [] }: { p: PublicProduct; offers?: Offer[] }) {
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
          <p className="text-sm font-semibold text-brand">
            <Link href={`/explore?category=${p.category}`}>{t(catKey(p.category))}</Link>
            {p.subcategory ? <> <span className="text-muted">›</span> <Link href={`/explore?category=${p.category}&sub=${p.subcategory}`}>{t(subKey(p.subcategory))}</Link></> : null}
          </p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <h1 className="font-display text-3xl leading-tight md:text-4xl">{p.name}</h1>
            <FavoriteButton kind="product" id={p.id} />
          </div>
          {p.review_count ? <a href="#reviews" className="mt-1 inline-block"><RatingSummary rating={p.rating} count={p.review_count} size="md" /></a> : null}
          <p className="mt-3 text-3xl font-bold text-brand">{formatDZD(p.price_dzd)}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-brand-soft px-2.5 py-1 text-brand inline-flex items-center gap-1"><Icon name="home" className="h-3.5 w-3.5" />{t("handmade")}</span>
            {p.pay_cod !== false ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-ok inline-flex items-center gap-1"><Icon name="cash" className="h-3.5 w-3.5" />{t("cod")}</span> : null}
            {p.pay_card !== false ? <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-800 inline-flex items-center gap-1"><Icon name="shield" className="h-3.5 w-3.5" />{t("pay_card")}</span> : null}
            {p.deposit_pct ? <span className="rounded-full bg-gold-soft px-2.5 py-1 text-ink inline-flex items-center gap-1"><Icon name="cash" className="h-3.5 w-3.5 text-gold" />{t("pay_deposit", { pct: p.deposit_pct })}</span> : null}
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-muted inline-flex items-center gap-1"><Icon name="truck" className="h-3.5 w-3.5" />{t("delivery_from", { price: formatDZD(minFee(p.shop)) })}</span>
          </div>
          {p.tags?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {offers.filter((o) => p.tags?.includes(o.slug)).map((o) => (
                <Link key={o.slug} href={`/explore?collection=${o.slug}`} className="rounded-full border border-gold/50 bg-gold-soft/60 px-2.5 py-0.5 text-xs font-semibold">{offerTitle(o, lang)}</Link>
              ))}
            </div>
          ) : null}
          {p.description ? <p className="mt-5 whitespace-pre-line leading-relaxed text-ink/90">{p.description}</p> : null}
          {p.story ? (
            <section className="mt-5 rounded-2xl border border-gold/40 bg-gold-soft/40 p-4">
              <h2 className="mb-1 flex items-center gap-2 font-display text-xl"><span className="h-2 w-2 rotate-45 bg-gold" aria-hidden />{t("product_story")}</h2>
              <p className="whitespace-pre-line leading-relaxed text-ink/90">{p.story}</p>
              <p className="mt-2 text-sm font-semibold text-brand">{t("made_by", { shop: p.shop.name, wilaya: wilayaLabel(p.shop.wilaya, lang).replace(/^\d+ - /, "") })}</p>
            </section>
          ) : null}

          <div className="mt-6 hidden items-center gap-3 md:flex">
            <Qty qty={qty} setQty={setQty} />
            <Button className="flex-1 text-lg" onClick={order}>{t("order_this")} · {formatDZD(p.price_dzd * qty)}</Button>
          </div>

          <Link href={`/s/${p.shop.slug}`} className="mt-6 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:shadow-sm">
            <ShopLogo name={p.shop.name} logo={p.shop.logo} logoUrl={p.shop.logo_url} category={p.shop.category} size={48} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">{t("sold_by")}</p>
              <p className="flex items-center gap-1.5 font-semibold"><span className="truncate">{p.shop.name}</span>{p.shop.verified ? <VerifiedBadge compact /> : null}</p>
              <p className="text-xs text-muted">
                {wilayaLabel(p.shop.wilaya, lang).replace(/^\d+ - /, "")}
                {p.shop.delivered_count ? ` · ✓ ${t("delivered_count", { n: p.shop.delivered_count })}` : ""}
              </p>
            </div>
            <span className="text-sm font-semibold text-brand">{t("view_shop")} →</span>
          </Link>
        </div>
      </main>

      <div id="reviews" className="mx-auto mt-10 max-w-6xl scroll-mt-20 px-4">
        <ReviewList reviews={p.reviews ?? []} rating={p.rating} count={p.review_count} />
        <Link href="/confiance" className="mt-2 inline-block text-sm font-semibold text-brand">{t("trust_title")} →</Link>
      </div>

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
