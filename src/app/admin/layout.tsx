"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useI18n, LangSwitch } from "@/lib/i18n";
import { useSession } from "@/lib/useSession";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { Spinner } from "@/components/ui";
import type { DictKey } from "@/lib/i18n/dict";

type Counts = { applications: number; review_queue: number; reports: number; refunds: number; offers: number };
type Item = { href: string; key: DictKey; icon: string; badge?: keyof Counts };
const GROUPS: { key: DictKey; items: Item[] }[] = [
  { key: "adm_g_overview", items: [{ href: "/admin", key: "adm_nav_dashboard", icon: "grid" }] },
  { key: "adm_g_sellers", items: [
    { href: "/admin/shops", key: "adm_nav_shops", icon: "store", badge: "applications" },
    { href: "/admin/products", key: "adm_nav_products", icon: "bag" },
    { href: "/admin/review", key: "adm_nav_review", icon: "check", badge: "review_queue" },
  ] },
  { key: "adm_g_sales", items: [
    { href: "/admin/orders", key: "adm_nav_orders", icon: "cart" },
    { href: "/admin/payments", key: "adm_nav_payments", icon: "cash", badge: "refunds" },
    { href: "/admin/reports", key: "adm_nav_reports", icon: "shield", badge: "reports" },
  ] },
  { key: "adm_g_buyers", items: [
    { href: "/admin/customers", key: "adm_nav_customers", icon: "user" },
    { href: "/admin/reviews", key: "adm_nav_reviews", icon: "star" },
  ] },
  { key: "adm_g_marketing", items: [
    { href: "/admin/offers", key: "adm_nav_offers", icon: "gift", badge: "offers" },
    { href: "/admin/banners", key: "adm_nav_banners", icon: "sun" },
  ] },
  { key: "adm_g_system", items: [
    { href: "/admin/journal", key: "adm_nav_journal", icon: "map" },
    { href: "/admin/settings", key: "adm_nav_settings", icon: "home" },
  ] },
];

/** Bledify back office. Access is checked in the database (is_admin) on every admin call. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const user = useSession();
  const path = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!user) return;
    void supabase().rpc("is_admin").then(({ data }) => setAdmin(Boolean(data)));
  }, [user]);
  useEffect(() => {
    if (!admin) return;
    void supabase().rpc("admin_counts").then(({ data }) => setCounts(data as Counts));
  }, [admin, path]);
  useEffect(() => { queueMicrotask(() => setMenu(false)); }, [path]);

  if (user === undefined || (user && admin === null)) return <div className="flex min-h-dvh items-center justify-center"><Spinner /></div>;
  if (!user || !admin) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <Logo height={32} />
        <Icon name="shield" className="h-10 w-10 text-muted" />
        <p className="text-muted">{t("admin_only")}</p>
        <Link href="/" className="font-semibold text-brand">{t("admin_back_site")} →</Link>
      </main>
    );
  }

  const isOn = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  const nav = (
    <nav className="space-y-4 p-3">
      {GROUPS.map((g) => (
        <div key={g.key}>
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{t(g.key)}</p>
          <ul>
            {g.items.map((i) => {
              const n = i.badge && counts ? counts[i.badge] : 0;
              return (
                <li key={i.href}>
                  <Link href={i.href} className={`flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold ${isOn(i.href) ? "bg-brand text-white" : "text-ink hover:bg-sand"}`}>
                    <Icon name={i.icon} className="h-4.5 w-4.5 shrink-0" />
                    <span className="flex-1 truncate">{t(i.key)}</span>
                    {n ? <span className={`rounded-full px-1.5 text-[11px] font-bold ${isOn(i.href) ? "bg-white text-brand" : "bg-accent text-white"}`}>{n}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh bg-ivory">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
        <div className="flex items-center gap-2 px-3 py-2">
          <button type="button" aria-label={t("adm_menu")} onClick={() => setMenu(!menu)} className="rounded-lg p-2 hover:bg-sand lg:hidden"><Icon name="grid" className="h-5 w-5" /></button>
          <Link href="/admin" className="flex shrink-0 items-center gap-2"><Logo height={22} /><span className="hidden text-xs font-semibold text-muted xl:inline">{t("admin_title")}</span></Link>
          <form className="min-w-0 flex-1" onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/admin/search?q=${encodeURIComponent(q.trim())}`); }}>
            <label className="relative block">
              <Icon name="search" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("adm_global_search")} dir="auto"
                className="w-full rounded-xl border border-line bg-ivory py-2 ps-9 pe-3 text-sm" />
            </label>
          </form>
          <LangSwitch className="hidden sm:inline-flex [&_button]:px-2" />
          <Link href="/" className="hidden shrink-0 text-sm font-semibold text-brand md:inline">{t("admin_back_site")}</Link>
        </div>
      </header>
      <div className="flex">
        <aside className="sticky top-[53px] hidden h-[calc(100dvh-53px)] w-60 shrink-0 overflow-y-auto border-e border-line bg-surface lg:block">{nav}</aside>
        {menu ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog">
            <button type="button" aria-label={t("close")} className="absolute inset-0 bg-black/30" onClick={() => setMenu(false)} />
            <aside className="absolute inset-y-0 start-0 w-72 max-w-[85vw] overflow-y-auto bg-surface shadow-xl">
              <div className="flex items-center justify-between border-b border-line p-3"><Logo height={22} /><LangSwitch className="[&_button]:px-2" /></div>
              {nav}
              <Link href="/" className="block px-5 pb-6 text-sm font-semibold text-brand">{t("admin_back_site")} →</Link>
            </aside>
          </div>
        ) : null}
        <main className="min-w-0 flex-1 px-4 py-5 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
