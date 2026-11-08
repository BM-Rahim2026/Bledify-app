"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import { wilayaLabel } from "@/lib/wilayas";
import { payLabel, type HistoryEntry, type OrderItem } from "@/lib/orders";
import { Button, Card, Field, Input, Spinner, StatusPill } from "@/components/ui";
import { Pill, Section, adminCall, useAdminRpc } from "@/components/admin/AdminUI";
import type { DictKey } from "@/lib/i18n/dict";

type Order = {
  id: string; number: string; status: string; payment_status: string; payment_method: string; created_at: string;
  customer_name: string; phone: string; wilaya: string; commune: string; address: string; delivery_type: string; note: string;
  items: OrderItem[]; delivery_dzd: number; total_dzd: number; amount_online_dzd: number; amount_cod_dzd: number;
  commission_dzd: number; seller_net_dzd: number; payout_available_at: string | null; paid_at: string | null;
  carrier: string; tracking_number: string; history: HistoryEntry[]; source: string; customer_email: string | null;
  shop: { id: string; name: string; slug: string; phone: string; wilaya: string };
  ledger: { kind: string; amount_dzd: number; available_at: string; created_at: string }[];
};

export default function AdminOrder() {
  const { id } = useParams<{ id: string }>();
  const { t, lang, formatDZD } = useI18n();
  const { data: o, reload } = useAdminRpc<Order>("admin_order", { p_order: id });
  const [credit, setCredit] = useState("0");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<boolean | null>(null);

  if (!o) return <div className="py-16 text-center"><Spinner /></div>;
  const row = (label: string, value: React.ReactNode) => <p className="flex justify-between gap-3"><span className="text-muted">{label}</span><span className="text-end">{value}</span></p>;
  return (
    <div className="space-y-5">
      <Link href="/admin/orders" className="text-sm font-semibold text-brand">← {t("adm_back")}</Link>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl" dir="ltr">{o.number}</h1>
          <p className="text-sm text-muted">{formatDateTime(o.created_at, lang)} · <Link href={`/admin/shops/${o.shop.id}`} className="text-brand">{o.shop.name}</Link></p>
        </div>
        <StatusPill status={o.status} />
      </div>

      {o.payment_status === "refund_due" ? (
        <Card className="space-y-2 border-danger/30 bg-rose-50/50">
          <h2 className="font-semibold text-danger">{t("adm_refund_title")}</h2>
          <p className="text-sm">{t("adm_refund_hint", { amount: formatDZD(o.amount_online_dzd) })}</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("adm_shop_credit")}><Input type="number" min={0} max={o.amount_online_dzd} value={credit} onChange={(e) => setCredit(e.target.value)} /></Field>
            <Field label={t("adm_note")}><Input value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} /></Field>
          </div>
          <Button size="sm" onClick={async () => {
            const ok = await adminCall("admin_resolve_refund", { p_order: o.id, p_shop_credit: Math.round(Number(credit) || 0), p_note: note });
            setMsg(ok); if (ok) await reload();
          }}>{t("adm_mark_refunded")}</Button>
          {msg === false ? <p className="text-sm text-danger">{t("error")}</p> : null}
        </Card>
      ) : null}

      <Section title={t("customer")}>
        <Card className="space-y-1 text-sm">
          {row(t("customer_name"), o.customer_name)}
          {row(t("phone"), <a href={`tel:${o.phone}`} className="text-brand" dir="ltr">{o.phone}</a>)}
          {o.customer_email ? row(t("adm_email"), <span dir="ltr">{o.customer_email}</span>) : null}
          {row(t("wilaya"), `${wilayaLabel(o.wilaya, lang)}${o.commune ? `, ${o.commune}` : ""}`)}
          {row(t("delivery"), `${t(o.delivery_type as DictKey)}${o.address ? ` · ${o.address}` : ""}`)}
          {o.tracking_number ? row(t("tracking_number"), <span dir="ltr">{o.carrier} {o.tracking_number}</span>) : null}
          {o.note ? <p className="rounded-lg bg-sand p-2" dir="auto">{o.note}</p> : null}
        </Card>
      </Section>

      <Section title={t("items")}>
        <Card className="space-y-1 text-sm">
          {o.items.map((i, k) => <div key={k}>{row(`${i.name} ×${i.quantity}`, formatDZD(i.unit_price_dzd * i.quantity))}</div>)}
          {row(t("delivery_fee"), formatDZD(o.delivery_dzd))}
          <div className="border-t border-line pt-1 font-bold">{row(t("total"), formatDZD(o.total_dzd))}</div>
        </Card>
      </Section>

      <Section title={t("pay_method")}>
        <Card className="space-y-1 text-sm">
          {row(t("pay_method"), <Pill tone={o.payment_status === "paid" ? "ok" : o.payment_status === "refund_due" ? "danger" : "muted"}>{t(payLabel(o.payment_status))}</Pill>)}
          {o.amount_online_dzd ? row(t("pay_now_amount"), formatDZD(o.amount_online_dzd)) : null}
          {row(t("collect_on_delivery"), formatDZD(o.amount_cod_dzd))}
          {o.commission_dzd ? row(t("ledger_commission"), formatDZD(o.commission_dzd)) : null}
          {o.seller_net_dzd ? row(t("adm_money"), formatDZD(o.seller_net_dzd)) : null}
          {o.ledger.length ? (
            <div className="border-t border-line pt-1">
              <p className="mb-1 font-semibold">{t("adm_ledger")}</p>
              {o.ledger.map((l, k) => <p key={k} className="flex justify-between text-xs"><span>{t(`ledger_${l.kind}` as DictKey)} · {formatDateTime(l.created_at, lang)}</span><span dir="ltr">{l.amount_dzd > 0 ? "+" : "−"}{formatDZD(Math.abs(l.amount_dzd))}</span></p>)}
            </div>
          ) : null}
        </Card>
      </Section>

      <Section title={t("history")}>
        <Card>
          <ol className="space-y-1 text-sm">
            {[...o.history].reverse().map((h, k) => (
              <li key={k} className="flex justify-between gap-3"><span>{t((h.status === "no_answer" ? "st_no_answer" : `st_${h.status}`) as DictKey)}</span><span className="text-muted">{formatDateTime(h.at, lang)}</span></li>
            ))}
          </ol>
        </Card>
      </Section>
    </div>
  );
}
