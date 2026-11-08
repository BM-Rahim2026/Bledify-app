"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useI18n, LangSwitch } from "@/lib/i18n";
import { useSession } from "@/lib/useSession";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { Spinner } from "@/components/ui";

const TABS = [
  { href: "/admin/offers", key: "admin_proposals" },
  { href: "/admin/offers/manage", key: "admin_manage_offers" },
] as const;

/** Bledify team area. Access is checked in the database (is_admin) on every admin call. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const user = useSession();
  const path = usePathname();
  const [admin, setAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    void supabase().rpc("is_admin").then(({ data }) => setAdmin(Boolean(data)));
  }, [user]);

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
  return (
    <div className="min-h-dvh bg-ivory">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-4 py-2">
          <Link href="/admin/offers" className="flex items-center gap-2"><Logo height={24} /><span className="hidden text-sm font-semibold text-muted min-[400px]:inline">{t("admin_title")}</span></Link>
          <div className="flex items-center gap-2">
            <LangSwitch className="[&_button]:px-2" />
            <Link href="/" className="text-sm font-semibold text-brand">{t("admin_back_site")}</Link>
          </div>
        </div>
        <nav className="mx-auto flex max-w-4xl gap-1 px-4">
          {TABS.map((x) => {
            const on = x.href === "/admin/offers" ? path === "/admin/offers" : path.startsWith(x.href);
            return <Link key={x.href} href={x.href} className={`border-b-2 px-3 py-2 text-sm font-semibold ${on ? "border-brand text-brand" : "border-transparent text-muted"}`}>{t(x.key)}</Link>;
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-5">{children}</main>
    </div>
  );
}
