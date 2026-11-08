"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";

export function OffersSubnav() {
  const { t } = useI18n();
  const path = usePathname();
  return (
    <div className="mb-4 inline-flex rounded-full border border-line bg-surface p-0.5 text-sm font-semibold">
      {([["/admin/offers", "admin_proposals"], ["/admin/offers/manage", "admin_manage_offers"]] as const).map(([href, key]) => (
        <Link key={href} href={href} className={`rounded-full px-3 py-1 ${path === href ? "bg-brand text-white" : "text-muted"}`}>{t(key)}</Link>
      ))}
    </div>
  );
}
