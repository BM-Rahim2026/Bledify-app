import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { LEGAL_DOCS, legalKey } from "@/lib/legal";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicNav } from "@/components/PublicNav";
import { Icon } from "@/components/Icon";
import { SectionTitle } from "@/components/home/Sections";
import type { DictKey } from "@/lib/i18n/dict";

export const metadata: Metadata = { title: "Achetez en confiance" };

const POINTS: { icon: string; k: string }[] = [
  { icon: "cash", k: "cod" }, { icon: "shield", k: "verified" }, { icon: "star", k: "reviews" },
  { icon: "truck", k: "delivery" }, { icon: "heart", k: "problem" }, { icon: "map", k: "local" },
];

export default async function TrustPage() {
  const { t } = await getT();
  return (
    <div className="min-h-dvh bg-ivory pb-24">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <section className="rounded-3xl bg-brand px-5 py-7 text-white">
          <Icon name="shield" className="h-10 w-10 text-gold-soft" />
          <h1 className="mt-3 font-display text-3xl">{t("trust_title")}</h1>
          <p className="mt-2 leading-relaxed text-white/85">{t("trust_intro")}</p>
        </section>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {POINTS.map(({ icon, k }) => (
            <div key={k} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-soft text-brand"><Icon name={icon} className="h-5 w-5" /></span>
              <h2 className="mt-3 font-semibold">{t(`trust_${k}_title` as DictKey)}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t(`trust_${k}_body` as DictKey)}</p>
            </div>
          ))}
        </div>
        <section className="mt-8">
          <SectionTitle title={t("policies")} />
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {LEGAL_DOCS.map((d) => (
              <li key={d}>
                <Link href={`/legal/${d}`} className="flex items-center justify-between gap-3 px-4 py-3.5 font-semibold hover:bg-sand">
                  {t(legalKey(d))}<Icon name="arrow" className="h-4 w-4 text-muted rtl:rotate-180" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <PublicNav />
    </div>
  );
}
