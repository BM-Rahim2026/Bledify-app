"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { STATUS_COLOR } from "@/lib/orders";
import { Spinner } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { Section, Stat, useAdminRpc } from "@/components/admin/AdminUI";
import type { DictKey } from "@/lib/i18n/dict";

type Dash = {
  orders_today: number; orders_7d: number; orders_30d: number; gmv_30d: number; commission_30d: number;
  by_status_30d: Record<string, number>; shops_total: number; shops_verified: number; shops_suspended: number; shops_new_7d: number;
  products_active: number; products_blocked: number; customers: number; users: number;
  pending_offers: number; refunds_due: number; applications: number; payouts_due: number; unverified_shops: number; reviews_7d: number;
};

/** Marketplace at a glance, and what the team has to deal with. */
export default function AdminDashboard() {
  const { t, formatDZD } = useI18n();
  const { data: d } = useAdminRpc<Dash>("admin_dashboard", {});
  if (!d) return <div className="py-16 text-center"><Spinner /></div>;

  const todo = [
    d.applications ? { href: "/admin/shops?f=pending", icon: "store", text: d.applications === 1 ? t("adm_todo_applications_one") : t("adm_todo_applications", { n: d.applications }) } : null,
    d.pending_offers ? { href: "/admin/offers", icon: "gift", text: d.pending_offers === 1 ? t("adm_todo_offers_one") : t("adm_todo_offers", { n: d.pending_offers }) } : null,
    d.refunds_due ? { href: "/admin/payments", icon: "cash", text: d.refunds_due === 1 ? t("adm_todo_refunds_one") : t("adm_todo_refunds", { n: d.refunds_due }) } : null,
    d.payouts_due ? { href: "/admin/payments", icon: "truck", text: t("adm_todo_payouts", { amount: formatDZD(d.payouts_due) }) } : null,
    d.unverified_shops ? { href: "/admin/shops?f=unverified", icon: "shield", text: d.unverified_shops === 1 ? t("adm_todo_verify_one") : t("adm_todo_verify", { n: d.unverified_shops }) } : null,
  ].filter(Boolean) as { href: string; icon: string; text: string }[];
  const statusTotal = Object.values(d.by_status_30d).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-6">
      <Section title={t("adm_todo")}>
        {todo.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {todo.map((x) => (
              <Link key={x.text} href={x.href} className="flex items-center gap-3 rounded-2xl border border-gold/50 bg-gold-soft/50 p-3 font-semibold">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold text-white"><Icon name={x.icon} className="h-4.5 w-4.5" /></span>
                <span className="min-w-0 flex-1">{x.text}</span>
                <Icon name="arrow" className="h-4 w-4 text-muted rtl:rotate-180" />
              </Link>
            ))}
          </div>
        ) : <p className="rounded-2xl border border-line bg-surface p-3 text-sm text-ok">{t("adm_nothing_todo")}</p>}
      </Section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("adm_orders_today")} value={d.orders_today} sub={`${t("adm_orders_7d")} : ${d.orders_7d}`} href="/admin/orders" />
        <Stat label={t("adm_orders_30d")} value={d.orders_30d} href="/admin/orders" />
        <Stat label={t("adm_gmv_30d")} value={formatDZD(d.gmv_30d)} />
        <Stat label={t("adm_commission_30d")} value={formatDZD(d.commission_30d)} />
        <Stat label={t("adm_nav_shops")} value={d.shops_total} sub={`${t("adm_shops_verified", { n: d.shops_verified })} · ${t("adm_shops_new", { n: d.shops_new_7d })}`} href="/admin/shops" />
        <Stat label={t("adm_products_active")} value={d.products_active} sub={d.products_blocked ? t("adm_products_blocked_n", { n: d.products_blocked }) : undefined} href="/admin/products" />
        <Stat label={t("adm_customers")} value={d.customers} sub={`${t("adm_users")} : ${d.users}`} />
        <Stat label={t("adm_nav_reviews")} value={d.reviews_7d} sub="7 j" href="/admin/reviews" />
      </div>

      <Section title={t("adm_status_30d")}>
        <div className="space-y-1.5 rounded-2xl border border-line bg-surface p-3">
          {Object.entries(d.by_status_30d).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
            <div key={s} className="flex items-center gap-2 text-sm">
              <span className="w-24 shrink-0 truncate">{t(`st_${s}` as DictKey)}</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-sand">
                <span className={`block h-full ${STATUS_COLOR[s] ?? "bg-stone-400"}`} style={{ width: `${(n / statusTotal) * 100}%` }} />
              </span>
              <span className="w-8 shrink-0 text-end font-semibold">{n}</span>
            </div>
          ))}
          {Object.keys(d.by_status_30d).length === 0 ? <p className="text-sm text-muted">{t("adm_none")}</p> : null}
        </div>
      </Section>
    </div>
  );
}
