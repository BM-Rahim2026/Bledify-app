"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SellerProvider } from "@/lib/seller";
import { useI18n, LangSwitch } from "@/lib/i18n";
import { ShopForm } from "@/components/ShopForm";
import { Spinner } from "@/components/ui";
import type { DictKey } from "@/lib/i18n/dict";

const NAV: { href: string; key: DictKey; icon: string }[] = [
  { href: "/seller", key: "nav_home", icon: "M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" },
  { href: "/seller/orders", key: "nav_orders", icon: "M6 3h12l1 4H5zM5 7h14v13a1 1 0 01-1 1H6a1 1 0 01-1-1zM9 11h6" },
  { href: "/seller/products", key: "nav_products", icon: "M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10" },
  { href: "/seller/stats", key: "nav_stats", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/seller/settings", key: "nav_shop", icon: "M4 9l1-5h14l1 5M4 9v11h16V9M4 9h16M9 20v-6h6v6" },
];

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { t } = useI18n();
  const printing = path.startsWith("/seller/labels");

  return (
    <SellerProvider
      fallback={<div className="flex min-h-dvh items-center justify-center"><Spinner /></div>}
      onboarding={(user, done) => (
        <main className="mx-auto max-w-md px-4 py-6">
          <div className="mb-6 flex items-center justify-between">
            <span className="font-display text-2xl text-brand">Bledify</span>
            <LangSwitch />
          </div>
          <h1 className="mb-4 font-display text-3xl">{t("setup_title")}</h1>
          <ShopForm ownerId={user.id} defaultEmail={user.email} onSaved={done} />
        </main>
      )}
    >
      {printing ? children : (
        <div className="mx-auto min-h-dvh max-w-2xl pb-24">
          {children}
          {path === "/seller" || path.startsWith("/seller/assistant") ? null : (
            <Link href="/seller/assistant" aria-label={t("ai_assistant")}
              className="no-print fixed bottom-20 end-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-2xl text-white shadow-lg ring-4 ring-sand transition hover:scale-105">
              ✨
            </Link>
          )}
          <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
            <ul className="mx-auto grid max-w-2xl grid-cols-5">
              {NAV.map((n) => {
                const active = n.href === "/seller" ? path === "/seller" : path.startsWith(n.href);
                return (
                  <li key={n.href}>
                    <Link href={n.href} className={`flex flex-col items-center gap-0.5 overflow-hidden text-ellipsis whitespace-nowrap px-0.5 py-2 text-[10px] font-semibold min-[360px]:text-[11px] ${active ? "text-brand" : "text-muted"}`}>
                      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>
                      {t(n.key)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      )}
    </SellerProvider>
  );
}
