"use client";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import { PAYMENT_STATUSES, SETTABLE, payLabel } from "@/lib/orders";
import { Select, Spinner, StatusPill } from "@/components/ui";
import { DataTable, Pill, SearchInput, useAdminRpc, type Col } from "@/components/admin/AdminUI";
import type { DictKey } from "@/lib/i18n/dict";

type Row = {
  id: string; number: string; status: string; payment_status: string; payment_method: string; total_dzd: number;
  amount_online_dzd: number; customer_name: string; phone: string; wilaya: string; created_at: string; source: string;
  items_count: number; shop: { id: string; name: string; slug: string };
};

/** Every order on the marketplace: search, filter, sort, export. */
export default function AdminOrders() {
  const { t, lang, formatDZD } = useI18n();
  const [q, setQ] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [pay, setPay] = useState("");
  useEffect(() => { queueMicrotask(() => setQ(new URLSearchParams(window.location.search).get("q") ?? "")); }, []);
  const { data } = useAdminRpc<Row[]>("admin_orders", { p_q: q ?? "", p_status: status, p_payment: pay });
  const onSearch = useCallback((v: string) => setQ(v), []);
  const payTone = (s: string) => (s === "paid" ? "ok" : s === "refund_due" || s === "failed" ? "danger" : s === "pending" ? "warn" : "muted") as "ok" | "danger" | "warn" | "muted";
  const cols: Col<Row>[] = [
    { key: "number", label: t("order_number"), sort: (o) => o.created_at, csv: (o) => o.number, render: (o) => <span dir="ltr">{o.number}</span> },
    { key: "date", label: t("adm_created"), sort: (o) => o.created_at, csv: (o) => o.created_at, render: (o) => <span className="whitespace-nowrap text-xs">{formatDateTime(o.created_at, lang)}</span> },
    { key: "customer", label: t("customer"), sort: (o) => o.customer_name.toLowerCase(), csv: (o) => `${o.customer_name} ${o.phone}`, render: (o) => <span>{o.customer_name}<span className="block text-xs text-muted" dir="ltr">{o.phone}</span></span> },
    { key: "shop", label: t("shop"), sort: (o) => o.shop.name, csv: (o) => o.shop.name, render: (o) => o.shop.name },
    { key: "status", label: t("status"), sort: (o) => o.status, csv: (o) => o.status, render: (o) => <StatusPill status={o.status} /> },
    { key: "pay", label: t("pay_method"), sort: (o) => o.payment_status, csv: (o) => `${o.payment_status} ${o.amount_online_dzd || ""}`, render: (o) => <Pill tone={payTone(o.payment_status)}>{t(payLabel(o.payment_status))}</Pill> },
    { key: "total", label: t("total"), sort: (o) => o.total_dzd, csv: (o) => o.total_dzd, render: (o) => <span className="whitespace-nowrap font-semibold">{formatDZD(o.total_dzd)}</span>, className: "text-end" },
  ];
  if (q === null) return <div className="py-16 text-center"><Spinner /></div>;
  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl">{t("adm_nav_orders")}</h1>
      <SearchInput initial={q} onSearch={onSearch} />
      <div className="grid grid-cols-2 gap-2">
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t("adm_all_statuses")}</option>
          {SETTABLE.map((s) => <option key={s} value={s}>{t(`st_${s}` as DictKey)}</option>)}
        </Select>
        <Select value={pay} onChange={(e) => setPay(e.target.value)}>
          <option value="">{t("adm_all_payments")}</option>
          {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{t(payLabel(s))}</option>)}
        </Select>
      </div>
      {!data ? <div className="py-16 text-center"><Spinner /></div> : <DataTable rows={data} cols={cols} rowKey={(o) => o.id} href={(o) => `/admin/orders/${o.id}`} filename="commandes" />}
    </div>
  );
}
