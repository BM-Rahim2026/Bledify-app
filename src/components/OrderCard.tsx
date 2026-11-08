"use client";
import Link from "next/link";
import { PaymentBadge } from "@/components/PaymentBadge";
import { useI18n } from "@/lib/i18n";
import { formatDateTime, prettyPhone } from "@/lib/format";
import { wilayaLabel } from "@/lib/wilayas";
import type { Order } from "@/lib/orders";
import { Card, RiskBadge, StatusPill } from "@/components/ui";
import { OrderActions } from "@/components/OrderActions";

export function OrderCard({ order: o, onChange }: { order: Order; onChange: (o: Order) => void }) {
  const { t, lang, formatDZD } = useI18n();
  return (
    <Card className="space-y-3">
      <Link href={`/seller/orders/${o.id}`} className="block space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{o.customer_name}</p>
            <p className="text-xs font-semibold text-muted" dir="ltr">{o.number} · {formatDateTime(o.created_at, lang)}</p>
          </div>
          <div className="shrink-0 text-end">
            <StatusPill status={o.status} />
            <p className="mt-1 whitespace-nowrap text-base font-bold text-brand">{formatDZD(o.total_dzd)}</p>
            <PaymentBadge o={o} />
          </div>
        </div>
        <p className="text-sm text-muted">
          <span dir="ltr">{prettyPhone(o.phone)}</span> · {wilayaLabel(o.wilaya, lang)}{o.commune ? `, ${o.commune}` : ""} · {t(o.delivery_type)}
        </p>
        <p className="truncate text-sm">{o.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}</p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {o.risk ? <RiskBadge /> : null}
          {o.no_answer_count > 0 ? (
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-muted">{t("no_answer_x", { n: o.no_answer_count })}</span>
          ) : null}
          {o.status === "shipped" && (o.carrier || o.tracking_number) ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800" dir="ltr">
              {[o.carrier, o.tracking_number].filter(Boolean).join(" · ")}
            </span>
          ) : null}
        </div>
      </Link>
      <OrderActions order={o} onChange={onChange} compact />
    </Card>
  );
}
