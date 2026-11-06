"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n/dict";

const ITEMS: { href: string; key: DictKey; icon: string }[] = [
  { href: "/", key: "nav_home", icon: "M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" },
  { href: "/explore", key: "explore", icon: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3" },
  { href: "/orders", key: "my_orders", icon: "M6 3h12l1 4H5zM5 7h14v13a1 1 0 01-1 1H6a1 1 0 01-1-1zM9 11h6" },
  { href: "/account", key: "account", icon: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0" },
];

/** Bottom tab bar for the buyer side on phones. */
export function PublicNav() {
  const { t } = useI18n();
  const path = usePathname();
  return (
    <>
      <div className="h-20 md:hidden" />
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden">
        <ul className="grid grid-cols-4">
          {ITEMS.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <li key={n.key}>
                <Link href={n.href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${active ? "text-brand" : "text-muted"}`}>
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>
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
