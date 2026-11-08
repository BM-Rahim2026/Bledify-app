"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { Spinner } from "@/components/ui";
import { Chips, DataTable, Pill, SearchInput, useAdminRpc, type Col } from "@/components/admin/AdminUI";

type Row = { id: string; email: string; name: string | null; phone: string | null; created_at: string; confirmed: boolean;
  orders: number; delivered: number; refused: number; spent: number; last_order: string | null; shop: { id: string; name: string } | null; blocked: boolean };
type F = "" | "buyers" | "sellers" | "risky" | "blocked";

/** Every account: buyers, sellers, risky (2+ refused / cancelled orders), blocked. */
export default function AdminCustomers() {
  const { t, lang, formatDZD } = useI18n();
  const [q, setQ] = useState("");
  const [f, setF] = useState<F>("");
  const { data } = useAdminRpc<Row[]>("admin_customers", { p_q: q, p_filter: f });
  const onSearch = useCallback((v: string) => setQ(v), []);
  const cols: Col<Row>[] = [
    { key: "name", label: t("customer_name"), sort: (c) => (c.name ?? c.email).toLowerCase(), csv: (c) => c.name ?? "", render: (c) => (
      <span>{c.name || "—"}<span className="block text-xs text-muted" dir="ltr">{c.email}</span></span>) },
    { key: "phone", label: t("phone"), csv: (c) => c.phone ?? "", render: (c) => <span dir="ltr">{c.phone || "—"}</span> },
    { key: "tags", label: t("status"), sort: (c) => (c.blocked ? 0 : c.refused >= 2 ? 1 : 2), csv: (c) => [c.blocked && "blocked", c.shop && "seller", !c.confirmed && "unconfirmed"].filter(Boolean).join(" "), render: (c) => (
      <span className="flex flex-wrap gap-1">
        {c.blocked ? <Pill tone="danger">{t("adm_blocked_user")}</Pill> : null}
        {c.refused >= 2 ? <Pill tone="warn">{t("risk")}</Pill> : null}
        {c.shop ? <Link href={`/admin/shops/${c.shop.id}`}><Pill tone="brand">{c.shop.name}</Pill></Link> : null}
        {!c.confirmed ? <Pill>{t("adm_unconfirmed")}</Pill> : null}
      </span>) },
    { key: "orders", label: t("adm_nav_orders"), sort: (c) => c.orders, csv: (c) => c.orders, render: (c) => `${c.orders} / ${c.delivered}`, className: "text-end" },
    { key: "refused", label: t("adm_returns"), sort: (c) => c.refused, csv: (c) => c.refused, render: (c) => c.refused, className: "text-end" },
    { key: "spent", label: t("adm_spent"), sort: (c) => c.spent, csv: (c) => c.spent, render: (c) => <span className="whitespace-nowrap">{formatDZD(c.spent)}</span>, className: "text-end" },
    { key: "last", label: t("adm_last_order"), sort: (c) => c.last_order ?? "", csv: (c) => c.last_order?.slice(0, 10) ?? "", render: (c) => (c.last_order ? formatDate(c.last_order, lang) : "—") },
    { key: "created", label: t("adm_created"), sort: (c) => c.created_at, csv: (c) => c.created_at.slice(0, 10), render: (c) => <span className="whitespace-nowrap">{formatDate(c.created_at, lang)}</span> },
  ];
  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl">{t("adm_nav_customers")}</h1>
      <SearchInput onSearch={onSearch} />
      <Chips value={f} onChange={setF} options={[{ key: "", label: t("all") }, { key: "buyers", label: t("adm_f_buyers") }, { key: "sellers", label: t("adm_f_sellers") }, { key: "risky", label: t("adm_f_risky") }, { key: "blocked", label: t("adm_f_blocked_users") }]} />
      {!data ? <div className="py-16 text-center"><Spinner /></div> : <DataTable rows={data} cols={cols} rowKey={(c) => c.id} href={(c) => `/admin/customers/${c.id}`} filename="comptes" />}
    </div>
  );
}
