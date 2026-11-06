import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { LangSwitch } from "@/lib/i18n";

export default async function Home() {
  const { t } = await getT();
  const feats = [t("feat_link"), t("feat_desk"), t("feat_risk"), t("feat_stats")];
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-6">
      <header className="flex items-center justify-between">
        <span className="font-display text-2xl text-brand">Bledify</span>
        <LangSwitch />
      </header>
      <section className="flex-1 py-12">
        <h1 className="font-display text-4xl leading-tight">{t("hero_title")}</h1>
        <p className="mt-4 text-lg text-muted">{t("hero_sub")}</p>
        <ul className="mt-8 space-y-3">
          {feats.map((f) => (
            <li key={f} className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-col gap-3">
          <Link href="/signup" className="rounded-xl bg-brand px-4 py-3 text-center font-semibold text-white">{t("start")}</Link>
          <Link href="/login" className="rounded-xl border border-line bg-surface px-4 py-3 text-center font-semibold">{t("login")}</Link>
        </div>
      </section>
      <footer className="py-4 text-center text-sm">
        <Link href="/track" className="text-brand underline">{t("track_order")}</Link>
      </footer>
    </main>
  );
}
