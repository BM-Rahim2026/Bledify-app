"use client";
import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { CATEGORIES, CATEGORY_IMAGE, COLLECTIONS, COLLECTION_ICON, COLLECTION_IMAGE, CAT_TINT, catKey, colKey } from "@/lib/categories";
import { Icon } from "@/components/Icon";

/** Section title with the gold line and Bledify diamond. */
export function SectionTitle({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <h2 className="min-w-0 font-display text-xl min-[360px]:text-2xl md:text-3xl">{title}</h2>
      <span className="relative h-px min-w-6 flex-1 bg-gold/50">
        <span className="absolute start-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-gold rtl:translate-x-1/2" />
      </span>
      {href ? <Link href={href} className="shrink-0 text-sm font-semibold text-brand">{linkLabel}</Link> : null}
    </div>
  );
}

/** 3×2 grid of category tiles (photo + icon + name). */
export function CategoryGrid({ fallback }: { fallback?: Record<string, string | null> }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-3 gap-2.5 md:grid-cols-6 md:gap-4">
      {CATEGORIES.map((c) => (
        <Link key={c} href={`/explore?category=${c}`} className="group overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          <span className={`relative block aspect-[4/3] overflow-hidden ${CAT_TINT[c]}`}>
            <Image src={CATEGORY_IMAGE[c] || fallback?.[c] || ""} alt="" fill sizes="(max-width: 768px) 33vw, 16vw" className="object-cover transition duration-500 group-hover:scale-105" />
          </span>
          <span className="flex min-h-12 items-center justify-center gap-1.5 bg-gold-soft/60 px-1.5 py-2 text-center">
            <Icon name={c} className="h-4 w-4 shrink-0 text-brand" />
            <span className="text-[11.5px] font-semibold leading-tight text-ink md:text-sm">{t(catKey(c))}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/** Seasonal banners: Mariée, Ramadan, Aïd, Été. */
export function SeasonalOffers() {
  const { t } = useI18n();
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-4 md:px-0">
      {COLLECTIONS.map((c) => (
        <Link key={c} href={`/explore?collection=${c}`} className="group relative h-40 w-[72%] shrink-0 snap-start overflow-hidden rounded-2xl shadow-sm md:w-auto">
          <Image src={COLLECTION_IMAGE[c]} alt="" fill sizes="(max-width: 768px) 72vw, 25vw" className="object-cover transition duration-500 group-hover:scale-105" />
          <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <span className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
            <span>
              <span className="mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-brand"><Icon name={COLLECTION_ICON[c]} className="h-4 w-4" /></span>
              <span className="block font-display text-xl leading-tight text-white">{t(colKey(c))}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-brand">
              {t("discover_more")} <Icon name="arrow" className="h-3.5 w-3.5 rtl:rotate-180" />
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/** Four promises, in a single white strip. */
export function TrustStrip() {
  const { t } = useI18n();
  const items = [
    { icon: "truck", label: t("trust_delivery") },
    { icon: "cash", label: t("trust_cod") },
    { icon: "shield", label: t("trust_local") },
    { icon: "heart", label: t("trust_favorites") },
  ];
  return (
    <Link href="/confiance" aria-label={t("trust_title")} className="grid grid-cols-4 divide-x divide-line rounded-2xl border border-line bg-surface py-3 shadow-sm rtl:divide-x-reverse">
      {items.map((x) => (
        <div key={x.icon} className="flex flex-col items-center gap-1.5 px-1 text-center">
          <Icon name={x.icon} className="h-6 w-6 text-brand" />
          <span className="text-[11px] font-semibold leading-tight text-ink md:text-sm">{x.label}</span>
        </div>
      ))}
    </Link>
  );
}
