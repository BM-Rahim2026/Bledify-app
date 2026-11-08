import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { CATEGORIES, CATEGORY_IMAGE, CAT_TINT, SUBCATEGORIES, catKey, catSubKey, subKey } from "@/lib/categories";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicNav } from "@/components/PublicNav";
import { Icon } from "@/components/Icon";
import { OffersSections, SectionTitle } from "@/components/home/Sections";
import { getOffers } from "@/lib/server/offers";

export const metadata: Metadata = { title: "Catégories" };

export default async function CategoriesPage() {
  const [{ t }, offers] = await Promise.all([getT(), getOffers()]);
  return (
    <div className="min-h-dvh bg-ivory">
      <PublicHeader />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-5">
        <section>
          <SectionTitle title={t("all_categories")} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((c) => (
              <div key={c} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                <Link href={`/explore?category=${c}`} className="group flex">
                  <span className={`relative w-32 shrink-0 overflow-hidden ${CAT_TINT[c]}`}>
                    <Image src={CATEGORY_IMAGE[c]} alt="" fill sizes="128px" className="object-cover transition duration-500 group-hover:scale-105" />
                  </span>
                  <span className="flex min-h-28 flex-col justify-center gap-1 p-4">
                    <span className="flex items-center gap-2 font-semibold"><Icon name={c} className="h-5 w-5 shrink-0 text-brand" />{t(catKey(c))}</span>
                    <span className="text-sm text-muted">{t(catSubKey(c))}</span>
                  </span>
                </Link>
                <div className="flex flex-wrap gap-1.5 border-t border-line bg-ivory/60 p-3">
                  {SUBCATEGORIES[c].map((sub) => (
                    <Link key={sub} href={`/explore?category=${c}&sub=${sub}`} className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink hover:border-brand">
                      {t(subKey(sub))}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
        <OffersSections offers={offers} />
      </main>
      <PublicNav />
    </div>
  );
}
