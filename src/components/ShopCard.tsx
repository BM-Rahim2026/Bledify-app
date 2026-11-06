"use client";
import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { wilayaLabel } from "@/lib/wilayas";

export type ShopCardData = {
  name: string; slug: string; wilaya: string; description: string; cover: string;
  product_count: number; delivered_count: number;
};

export function ShopCard({ s }: { s: ShopCardData }) {
  const { t, lang } = useI18n();
  return (
    <Link href={`/s/${s.slug}`} className="group block w-72 shrink-0 overflow-hidden rounded-3xl border border-line bg-surface shadow-sm transition hover:shadow-md sm:w-80">
      <div className="relative h-36 bg-sand">
        {s.cover ? <Image src={s.cover} alt="" fill sizes="320px" className="object-cover transition duration-500 group-hover:scale-105" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <span className="absolute bottom-3 start-3 flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-white bg-brand font-display text-xl text-white shadow">
          {s.name.replace(/^(Les|La|Le|L'|Dar|Atelier)\s+/i, "")[0]}
        </span>
      </div>
      <div className="p-4">
        <p className="truncate font-semibold">{s.name}</p>
        <p className="text-xs text-muted">{wilayaLabel(s.wilaya, lang).replace(/^\d+ - /, "")} · {t("products_count", { n: s.product_count })}</p>
        <p className="mt-2 line-clamp-2 text-sm text-muted">{s.description}</p>
        {s.delivered_count > 0 ? (
          <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-ok">
            ✓ {t("delivered_count", { n: s.delivered_count })}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
