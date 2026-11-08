"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatDate, formatDateTime } from "@/lib/format";
import { payLabel } from "@/lib/orders";
import { Button, Card, Input, Spinner, StatusPill } from "@/components/ui";
import { NotesAndLog, Pill, Section, Stat, adminCall, useAdminRpc } from "@/components/admin/AdminUI";
import type { DictKey } from "@/lib/i18n/dict";

type C = { id: string; email: string; name: string | null; phone: string | null; wilaya: string | null; created_at: string; confirmed: boolean;
  blocked: { reason: string; by: string; at: string } | null; shop: { id: string; name: string; status: string } | null; reviews: number;
  orders: { id: string; number: string; status: string; payment_status: string; total_dzd: number; created_at: string; shop: string }[];
  reports: { id: number; kind: string; reason: string; status: string; created_at: string }[] };

export default function AdminCustomer() {
  const { id } = useParams<{ id: string }>();
  const { t, lang, formatDZD } = useI18n();
  const { data: c, reload } = useAdminRpc<C>("admin_customer", { p_user: id });
  const [reason, setReason] = useState("");
  const [allOrders, setAllOrders] = useState(false);
  if (!c) return <div className="py-16 text-center"><Spinner /></div>;
  const delivered = c.orders.filter((o) => o.status === "delivered");
  const refused = c.orders.filter((o) => o.status === "returned" || o.status === "cancelled").length;
  return (
    <div className="space-y-5">
      <Link href="/admin/customers" className="text-sm font-semibold text-brand">← {t("adm_back")}</Link>
      <div>
        <h1 className="font-display text-2xl">{c.name || c.email}</h1>
        <p className="text-sm text-muted" dir="ltr">{c.email}{c.phone ? ` · ${c.phone}` : ""}</p>
        <p className="mt-1 flex flex-wrap gap-1.5 text-sm">
          <span className="text-muted">{t("adm_joined", { date: formatDate(c.created_at, lang) })}</span>
          {c.confirmed ? null : <Pill>{t("adm_unconfirmed")}</Pill>}
          {c.blocked ? <Pill tone="danger">{t("adm_blocked_user")}</Pill> : null}
          {refused >= 2 ? <Pill tone="warn">{t("risk")}</Pill> : null}
          {c.shop ? <Link href={`/admin/shops/${c.shop.id}`}><Pill tone="brand">{c.shop.name}</Pill></Link> : null}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("adm_nav_orders")} value={c.orders.length} />
        <Stat label={t("adm_spent")} value={formatDZD(delivered.reduce((s, o) => s + o.total_dzd, 0))} />
        <Stat label={t("adm_returns")} value={refused} />
        <Stat label={t("adm_nav_reviews")} value={c.reviews} />
      </div>
      <Section title={t("adm_account_actions")}>
        <Card className="space-y-2">
          {c.blocked ? (
            <>
              <p className="text-sm text-danger">{t("adm_blocked_since", { date: formatDate(c.blocked.at, lang), by: c.blocked.by })}{c.blocked.reason ? ` · ${c.blocked.reason}` : ""}</p>
              <Button size="sm" onClick={async () => { if (await adminCall("admin_set_user_blocked", { p_user: c.id, p_blocked: false })) await reload(); }}>{t("adm_unblock_user")}</Button>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Input placeholder={t("adm_block_user_reason")} value={reason} onChange={(e) => setReason(e.target.value)} className="min-w-0 flex-1" />
              <Button size="sm" variant="danger" onClick={async () => { if (await adminCall("admin_set_user_blocked", { p_user: c.id, p_blocked: true, p_reason: reason })) await reload(); }}>{t("adm_block_user")}</Button>
            </div>
          )}
          <p className="text-xs text-muted">{t("adm_block_user_hint")}</p>
          <a href={`mailto:${c.email}`} className="inline-block text-sm font-semibold text-brand">{t("adm_write_email")} ↗</a>
        </Card>
      </Section>
      <Section title={t("adm_nav_orders")}>
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {(allOrders ? c.orders : c.orders.slice(0, 20)).map((o) => (
            <li key={o.id}><Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-2 p-3 text-sm hover:bg-ivory">
              <span><b dir="ltr">{o.number}</b> · {o.shop}<span className="block text-xs text-muted">{formatDateTime(o.created_at, lang)} · {t(payLabel(o.payment_status))}</span></span>
              <span className="flex shrink-0 items-center gap-2"><StatusPill status={o.status} />{formatDZD(o.total_dzd)}</span>
            </Link></li>
          ))}
          {c.orders.length === 0 ? <li className="p-3 text-sm text-muted">{t("adm_none")}</li> : null}
        </ul>
        {c.orders.length > 20 && !allOrders ? <button type="button" onClick={() => setAllOrders(true)} className="text-sm font-semibold text-brand underline">{t("adm_show_all", { n: c.orders.length })}</button> : null}
      </Section>
      {c.reports.length ? (
        <Section title={t("adm_nav_reports")}>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
            {c.reports.map((r) => <li key={r.id} className="flex justify-between p-3"><span>{t(`report_reason_${r.reason}` as DictKey)} · {t(`adm_kind_${r.kind}` as DictKey)}</span><span className="text-muted">{t(`adm_report_${r.status}` as DictKey)}</span></li>)}
          </ul>
        </Section>
      ) : null}
      <NotesAndLog type="customer" id={c.id} logType="users" />
    </div>
  );
}
