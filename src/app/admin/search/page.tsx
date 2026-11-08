"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Spinner, StatusPill } from "@/components/ui";
import { Empty, Pill, Section, useAdminRpc } from "@/components/admin/AdminUI";

type R = {
  orders: { id: string; number: string; customer_name: string; total_dzd: number; status: string }[];
  shops: { id: string; name: string; slug: string; status: string }[];
  customers: { id: string; email: string; name: string | null }[];
  products: { id: string; name: string; shop: string }[];
};

/** One search box for orders (number, name, phone), shops, accounts and products. */
export default function AdminSearch() {
  const { t, formatDZD } = useI18n();
  const [q, setQ] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setQ(new URLSearchParams(window.location.search).get("q") ?? "");
    queueMicrotask(read);
    const id = setInterval(() => { const v = new URLSearchParams(window.location.search).get("q") ?? ""; setQ((old) => (old === v ? old : v)); }, 400);
    return () => clearInterval(id);
  }, []);
  const { data } = useAdminRpc<R>("admin_search", { p_q: q ?? "" });
  if (q === null || !data) return <div className="py-16 text-center"><Spinner /></div>;
  const none = !data.orders.length && !data.shops.length && !data.customers.length && !data.products.length;
  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl">{t("adm_results_for", { q })}</h1>
      {none ? <Empty /> : null}
      {data.orders.length ? <Section title={t("adm_nav_orders")}><ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {data.orders.map((o) => <li key={o.id}><Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-2 p-3 hover:bg-ivory"><span><b dir="ltr">{o.number}</b> · {o.customer_name}</span><span className="flex items-center gap-2"><StatusPill status={o.status} />{formatDZD(o.total_dzd)}</span></Link></li>)}
      </ul></Section> : null}
      {data.shops.length ? <Section title={t("adm_nav_shops")}><ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {data.shops.map((s) => <li key={s.id}><Link href={`/admin/shops/${s.id}`} className="flex items-center justify-between gap-2 p-3 hover:bg-ivory"><span className="font-semibold">{s.name}</span>{s.status !== "approved" ? <Pill tone="warn">{t(s.status === "pending" ? "adm_status_pending" : "adm_status_rejected")}</Pill> : null}</Link></li>)}
      </ul></Section> : null}
      {data.customers.length ? <Section title={t("adm_nav_customers")}><ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {data.customers.map((c) => <li key={c.id}><Link href={`/admin/customers/${c.id}`} className="block p-3 hover:bg-ivory"><b>{c.name || "—"}</b> <span className="text-sm text-muted" dir="ltr">{c.email}</span></Link></li>)}
      </ul></Section> : null}
      {data.products.length ? <Section title={t("adm_nav_products")}><ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {data.products.map((p) => <li key={p.id}><Link href={`/admin/products?q=${encodeURIComponent(p.name)}`} className="block p-3 hover:bg-ivory"><b>{p.name}</b> <span className="text-sm text-muted">· {p.shop}</span></Link></li>)}
      </ul></Section> : null}
    </div>
  );
}
