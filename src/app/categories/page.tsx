import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { CATEGORIES, CATEGORY_IMAGE, CAT_TINT, catKey, catSubKey } from "@/lib/categories";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicNav } from "@/components/PublicNav";
import { Icon } from "@/components/Icon";
import { SeasonalOffers, SectionTitle } from "@/components/home/Sections";

export const metadata: Metadata = { title: "Catégories" };

export default async function CategoriesPage() {
  const { t } = await getT();
  return (
    <div className="min-h-dvh bg-ivory">
      <PublicHeader />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-5">
        <section>
          <SectionTitle title={t("all_categories")} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((c) => (
              <Link key={c} href={`/explore?category=${c}`} className="group flex overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                <span className={`relative w-32 shrink-0 overflow-hidden ${CAT_TINT[c]}`}>
                  <Image src={CATEGORY_IMAGE[c]} alt="" fill sizes="128px" className="object-cover transition duration-500 group-hover:scale-105" />
                </span>
                <span className="flex min-h-28 flex-col justify-center gap-1 p-4">
                  <span className="flex items-center gap-2 font-semibold"><Icon name={c} className="h-5 w-5 text-brand" />{t(catKey(c))}</span>
                  <span className="text-sm text-muted">{t(catSubKey(c))}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section>
          <SectionTitle title={t("seasonal_offers")} />
          <SeasonalOffers />
        </section>
      </main>
      <PublicNav />
    </div>
  );
}
