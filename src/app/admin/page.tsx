"use client";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { catKey } from "@/lib/categories";
import { Spinner } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { Kpi, Section, useAdminRpc } from "@/components/admin/AdminUI";
import { DailyBars, RankBars } from "@/components/admin/Charts";

type Period = { orders: number; gmv: number; aov: number; commission: number; delivered: number; returned: number; cancelled: number;
  card_share: number; new_buyers: number; new_users: number; new_shops: number; new_products: number };
type A = {
  days: number; current: Period; previous: Period; daily: { day: string; orders: number; gmv: number }[];
  top_shops: { id: string; name: string; orders: number; gmv: number }[];
  top_categories: { category: string; gmv: number; units: number }[];
  top_products: { id: string; name: string; shop: string; units: number; gmv: number }[];
  catalog: { no_photo: number; no_subcategory: number; no_story: number; empty_shops: number; old_applications: number };
};
type Counts = { applications: number; review_queue: number; reports: number; refunds: number; offers: number };
const DAYS = [7, 30, 90] as const;

/** Marketplace performance for a period, what needs action, and catalog health. */
export default function AdminDashboard() {
  const { t, lang, formatDZD } = useI18n();
  const [days, setDays] = useState<(typeof DAYS)[number]>(30);
  const { data: a } = useAdminRpc<A>("admin_analytics", { p_days: days });
  const { data: c } = useAdminRpc<Counts>("admin_counts", {});
  const num = (n: number) => new Intl.NumberFormat(lang === "ar" ? "ar-DZ-u-nu-latn" : "fr-FR").format(n);
  const pct = (n: number) => `${n} %`;
  const rate = (p: Period, k: "delivered" | "returned") => {
    const done = p.delivered + p.returned + p.cancelled;
    return done ? Math.round((100 * (k === "delivered" ? p.delivered : p.returned)) / done) : 0;
  };
  const day = (d: string) => new Intl.DateTimeFormat(lang === "ar" ? "ar-DZ-u-nu-latn" : "fr-FR", { day: "2-digit", month: "short" }).format(new Date(d));

  const todo = c ? [
    { n: c.applications, href: "/admin/shops?f=pending", icon: "store", key: "adm_todo_applications" },
    { n: c.review_queue, href: "/admin/review", icon: "check", key: "adm_todo_review" },
    { n: c.reports, href: "/admin/reports", icon: "shield", key: "adm_todo_reports" },
    { n: c.refunds, href: "/admin/payments", icon: "cash", key: "adm_todo_refunds" },
    { n: c.offers, href: "/admin/offers", icon: "gift", key: "adm_todo_offers" },
  ] as const : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl">{t("adm_nav_dashboard")}</h1>
        <div className="inline-flex rounded-full border border-line bg-surface p-0.5 text-sm font-semibold" role="group" aria-label={t("adm_period")}>
          {DAYS.map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)} className={`rounded-full px-3 py-1 ${days === d ? "bg-ink text-white" : "text-muted"}`}>{t("adm_days", { n: d })}</button>
          ))}
        </div>
      </div>

      <Section title={t("adm_todo")}>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {todo.map((x) => (
            <Link key={x.key} href={x.href} className={`flex items-center gap-2 rounded-2xl border p-3 ${x.n ? "border-gold/60 bg-gold-soft/50" : "border-line bg-surface opacity-70"}`}>
              <Icon name={x.icon} className="h-5 w-5 shrink-0 text-brand" />
              <span className="min-w-0"><span className="block text-xl font-bold">{x.n}</span><span className="block text-xs text-muted">{t(`${x.key}_label` as never)}</span></span>
            </Link>
          ))}
        </div>
      </Section>

      {!a ? <div className="py-16 text-center"><Spinner /></div> : (
        <div className={`space-y-6 transition-opacity ${a.days !== days ? "opacity-50" : ""}`}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label={t("adm_k_gmv")} value={a.current.gmv} prev={a.previous.gmv} format={formatDZD} />
            <Kpi label={t("adm_k_orders")} value={a.current.orders} prev={a.previous.orders} format={num} />
            <Kpi label={t("adm_k_aov")} value={a.current.aov} prev={a.previous.aov} format={formatDZD} />
            <Kpi label={t("adm_k_commission")} value={a.current.commission} prev={a.previous.commission} format={formatDZD} />
            <Kpi label={t("adm_k_delivery_rate")} value={rate(a.current, "delivered")} prev={rate(a.previous, "delivered")} format={pct} />
            <Kpi label={t("adm_k_return_rate")} value={rate(a.current, "returned")} prev={rate(a.previous, "returned")} format={pct} />
            <Kpi label={t("adm_k_new_buyers")} value={a.current.new_buyers} prev={a.previous.new_buyers} format={num} />
            <Kpi label={t("adm_k_new_shops")} value={a.current.new_shops} prev={a.previous.new_shops} format={num} />
          </div>
          <p className="text-xs text-muted">{t("adm_k_note", { card: a.current.card_share, users: a.current.new_users, products: a.current.new_products })}</p>

          <div className="grid gap-3 lg:grid-cols-2">
            <DailyBars title={t("adm_chart_orders")} data={a.daily.map((d) => ({ label: d.day, value: d.orders }))} format={num} dateLabel={day} />
            <DailyBars title={t("adm_chart_gmv")} data={a.daily.map((d) => ({ label: d.day, value: d.gmv }))} format={formatDZD} dateLabel={day} />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <RankBars title={t("adm_top_shops")} rows={a.top_shops.map((s) => ({ label: s.name, value: s.gmv, display: formatDZD(s.gmv), sub: t("adm_orders_n", { n: s.orders }) }))} />
            <RankBars title={t("adm_top_categories")} rows={a.top_categories.map((x) => ({ label: t(catKey(x.category)), value: x.gmv, display: formatDZD(x.gmv) }))} />
            <RankBars title={t("adm_top_products")} rows={a.top_products.map((p) => ({ label: p.name, value: p.units, display: t("adm_units", { n: p.units }), sub: p.shop }))} />
          </div>

          <Section title={t("adm_catalog_health")}>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {([["no_photo", "/admin/products"], ["no_subcategory", "/admin/products"], ["no_story", "/admin/products"], ["empty_shops", "/admin/shops"], ["old_applications", "/admin/shops?f=pending"]] as const).map(([k, href]) => (
                <li key={k}><Link href={href} className="block rounded-2xl border border-line bg-surface p-3">
                  <span className="block text-xl font-bold">{a.catalog[k]}</span><span className="block text-xs text-muted">{t(`adm_cat_${k}` as never)}</span>
                </Link></li>
              ))}
            </ul>
          </Section>
        </div>
      )}
    </div>
  );
}
