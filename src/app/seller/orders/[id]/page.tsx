"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { formatDateTime, prettyPhone } from "@/lib/format";
import { wilayaLabel } from "@/lib/wilayas";
import type { Order } from "@/lib/orders";
import { Card, Empty, RiskBadge, Spinner, StatusPill } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { OrderActions } from "@/components/OrderActions";
import { OrderForm } from "@/components/OrderForm";
import type { DictKey } from "@/lib/i18n/dict";

export default function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, lang, formatDZD } = useI18n();
  const [o, setO] = useState<Order | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    supabase().from("orders_view").select("*").eq("id", id).maybeSingle().then(({ data }) => setO((data as Order) ?? null));
  }, [id]);

  if (o === undefined) return <div className="py-20 text-center"><Spinner /></div>;
  if (o === null) return <><PageHeader title={t("orders")} back="/seller/orders" /><Empty>{t("err_not_found")}</Empty></>;

  // status updates only replace status fields, keeping any unsaved edits elsewhere
  const onStatus = (u: Order) => setO((cur) => cur && ({
    ...cur, status: u.status, history: u.history, no_answer_count: u.no_answer_count,
    carrier: u.carrier, tracking_number: u.tracking_number, risk: u.risk, updated_at: u.updated_at,
  }));

  return (
    <>
      <PageHeader title={o.number} back="/seller/orders" action={
        <Link href={`/seller/labels?ids=${o.id}`} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold">🖨 {t("print_label")}</Link>
      } />
      <div className="space-y-4 p-4">
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t("status")}</h2>
            <StatusPill status={o.status} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {o.risk ? <RiskBadge /> : null}
            {o.no_answer_count > 0 ? <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-muted">{t("no_answer_x", { n: o.no_answer_count })}</span> : null}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted">{t("customer")}</dt><dd className="font-semibold">{o.customer_name}</dd>
            <dt className="text-muted">{t("phone")}</dt><dd dir="ltr" className="text-start"><a className="text-brand" href={`tel:${o.phone}`}>{prettyPhone(o.phone)}</a></dd>
            <dt className="text-muted">{t("delivery")}</dt>
            <dd>{t(o.delivery_type)} — {[o.address, o.commune, wilayaLabel(o.wilaya, lang)].filter(Boolean).join(", ")}</dd>
            {o.carrier || o.tracking_number ? (<>
              <dt className="text-muted">{t("tracking_number")}</dt>
              <dd dir="ltr" className="text-start font-semibold">{[o.carrier, o.tracking_number].filter(Boolean).join(" · ")}</dd>
            </>) : null}
            <dt className="text-muted">{t("created")}</dt><dd>{formatDateTime(o.created_at, lang)} · {t(o.source === "shop" ? "source_shop" : "source_manual")}</dd>
          </dl>
          <OrderActions order={o} onChange={onStatus} />
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold">{t("items")}</h2>
          <ul className="divide-y divide-line text-sm">
            {o.items.map((i, k) => (
              <li key={k} className="flex justify-between py-2"><span>{i.name} ×{i.quantity}</span><span>{formatDZD(i.unit_price_dzd * i.quantity)}</span></li>
            ))}
            <li className="flex justify-between py-2 text-muted"><span>{t("delivery_fee")}</span><span>{formatDZD(o.delivery_dzd)}</span></li>
            <li className="flex justify-between py-2 text-base font-bold"><span>{t("to_collect")}</span><span className="text-brand">{formatDZD(o.total_dzd)}</span></li>
          </ul>
          {o.note ? <p className="mt-2 rounded-lg bg-sand p-2 text-sm">{o.note}</p> : null}
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold">{t("history")}</h2>
          <ol className="space-y-2 border-s-2 border-line ps-4">
            {[...o.history].reverse().map((h, k) => (
              <li key={k} className="text-sm">
                <span className="font-semibold">{t(`st_${h.status}` as DictKey)}</span>
                <span className="ms-2 text-muted">{formatDateTime(h.at, lang)}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <button className="flex w-full items-center justify-between font-semibold" onClick={() => setEditing((x) => !x)} aria-expanded={editing}>
            {t("edit_order")} <span>{editing ? "−" : "+"}</span>
          </button>
          {editing ? <div className="mt-4"><OrderForm order={o} onSaved={(u) => setO((cur) => cur && { ...cur, ...u, status: cur.status, history: cur.history })} /></div> : null}
        </Card>
      </div>
    </>
  );
}
