"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useCartCount } from "@/lib/cart";
import { Icon } from "@/components/Icon";
import type { DictKey } from "@/lib/i18n/dict";

const ITEMS: { href: string; key: DictKey; icon: string }[] = [
  { href: "/", key: "nav_home", icon: "home" },
  { href: "/categories", key: "nav_categories", icon: "grid" },
  { href: "/explore", key: "explore", icon: "compass" },
  { href: "/cart", key: "nav_cart", icon: "bag" },
  { href: "/account", key: "account", icon: "user" },
];

/** Bottom tab bar (phones): Accueil · Catégories · Explorer · Panier · Compte. */
export function PublicNav() {
  const { t } = useI18n();
  const path = usePathname();
  const count = useCartCount();
  return (
    <>
      <div className="h-20 md:hidden" />
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden">
        <ul className="grid grid-cols-5">
          {ITEMS.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <li key={n.key}>
                <Link href={n.href} className={`relative flex flex-col items-center gap-0.5 whitespace-nowrap px-0.5 py-2 text-[11px] font-semibold ${active ? "text-brand" : "text-muted"}`}>
                  {active ? <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-brand" /> : null}
                  <span className="relative">
                    <Icon name={n.icon} className="h-6 w-6" fill={active && n.icon === "home" ? "currentColor" : "none"} />
                    {n.icon === "bag" && count ? (
                      <span className="absolute -end-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{count}</span>
                    ) : null}
                  </span>
                  {t(n.key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
