import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { LEGAL_DOCS, LEGAL_UPDATED, legalDoc, legalKey, type LegalDoc } from "@/lib/legal";
import { formatDate } from "@/lib/format";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicNav } from "@/components/PublicNav";
import { Icon } from "@/components/Icon";

const isDoc = (d: string): d is LegalDoc => (LEGAL_DOCS as readonly string[]).includes(d);

export async function generateMetadata({ params }: PageProps<"/legal/[doc]">): Promise<Metadata> {
  const { doc } = await params;
  const { t } = await getT();
  return { title: isDoc(doc) ? t(legalKey(doc)) : "Bledify" };
}

export default async function LegalPage({ params }: PageProps<"/legal/[doc]">) {
  const { doc } = await params;
  if (!isDoc(doc)) notFound();
  const { t, lang } = await getT();
  return (
    <div className="min-h-dvh bg-ivory pb-24">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Link href="/confiance" className="inline-flex items-center gap-1 text-sm font-semibold text-brand">
          <Icon name="arrow" className="h-4 w-4 rotate-180 rtl:rotate-0" />{t("trust_title")}
        </Link>
        <h1 className="mt-2 font-display text-3xl">{t(legalKey(doc))}</h1>
        <p className="mt-1 text-sm text-muted">{t("legal_updated", { date: formatDate(LEGAL_UPDATED, lang) })}</p>
        <p className="mt-3 rounded-xl border border-gold/40 bg-gold-soft/60 px-3 py-2 text-sm">{t("legal_draft")}</p>
        <article className="mt-6 space-y-6">
          {legalDoc(doc, lang).map((s) => (
            <section key={s.h}>
              <h2 className="font-display text-xl">{s.h}</h2>
              {s.p.map((p) => <p key={p} className="mt-2 leading-relaxed text-ink/90">{p}</p>)}
            </section>
          ))}
        </article>
        <nav className="mt-10 flex flex-wrap gap-2">
          {LEGAL_DOCS.filter((d) => d !== doc).map((d) => (
            <Link key={d} href={`/legal/${d}`} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold">{t(legalKey(d))}</Link>
          ))}
        </nav>
      </main>
      <PublicNav />
    </div>
  );
}
