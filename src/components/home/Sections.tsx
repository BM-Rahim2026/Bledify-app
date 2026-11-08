"use client";
import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { CATEGORIES, CATEGORY_IMAGE, CAT_TINT, catKey, catSubKey } from "@/lib/categories";
import { offerTitle, type Offer } from "@/lib/offers";
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
    <div className="grid grid-cols-2 gap-x-3 gap-y-4 md:grid-cols-4 md:gap-x-4">
      {CATEGORIES.map((c) => (
        <Link key={c} href={`/explore?category=${c}`} className="group block">
          <span className={`relative block aspect-[4/3] overflow-hidden rounded-2xl shadow-sm ${CAT_TINT[c]}`}>
            <Image src={CATEGORY_IMAGE[c] || fallback?.[c] || ""} alt="" fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover transition duration-500 group-hover:scale-105" />
            <span className="absolute start-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-ivory/90 text-brand shadow-sm">
              <Icon name={c} className="h-4.5 w-4.5" />
            </span>
          </span>
          <span className="mt-2 block font-display text-[17px] leading-tight text-ink">{t(catKey(c))}</span>
          <span className="mt-0.5 block text-xs leading-snug text-muted">{t(catSubKey(c))}</span>
        </Link>
      ))}
      {CATEGORIES.length % 2 ? <Link href="/categories" className="group flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gold/60 bg-gold-soft/40 text-center">
        <Icon name="grid" className="h-7 w-7 text-brand" />
        <span className="px-2 text-sm font-semibold text-brand">{t("all_categories")}</span>
      </Link> : null}
    </div>
  );
}

/** Offer banners (seasonal or special), as created by the Bledify team. */
export function OfferBanners({ offers }: { offers: Offer[] }) {
  const { t, lang } = useI18n();
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-4 md:px-0">
      {offers.map((o) => (
        <Link key={o.slug} href={`/explore?collection=${o.slug}`} className="group relative h-40 w-[72%] shrink-0 snap-start overflow-hidden rounded-2xl bg-sand shadow-sm md:w-auto">
          {o.image ? <Image src={o.image} alt="" fill sizes="(max-width: 768px) 72vw, 25vw" className="object-cover transition duration-500 group-hover:scale-105" /> : null}
          <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <span className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
            <span>
              <span className="mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-brand"><Icon name={o.icon} className="h-4 w-4" /></span>
              <span className="block font-display text-xl leading-tight text-white">{offerTitle(o, lang)}</span>
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

/** "Offres saisonnières" and, when the team adds some, "Offres spéciales". */
export function OffersSections({ offers }: { offers: Offer[] }) {
  const { t } = useI18n();
  const groups = [
    { key: "seasonal_offers", items: offers.filter((o) => o.kind === "seasonal") },
    { key: "special_offers", items: offers.filter((o) => o.kind === "special") },
  ] as const;
  return (
    <>
      {groups.filter((g) => g.items.length).map((g) => (
        <section key={g.key}>
          <SectionTitle title={t(g.key)} />
          <OfferBanners offers={g.items} />
        </section>
      ))}
    </>
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
