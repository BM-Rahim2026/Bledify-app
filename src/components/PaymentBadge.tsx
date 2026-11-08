"use client";
import { useI18n } from "@/lib/i18n";
import type { Order } from "@/lib/orders";

/** Cash the courier collects: what was not paid online. */
export const toCollect = (o: Pick<Order, "total_dzd" | "amount_online_dzd" | "payment_status">) =>
  o.payment_status === "paid" || o.payment_status === "refund_due" || o.payment_status === "refunded"
    ? Math.max(o.total_dzd - (o.amount_online_dzd ?? 0), 0) : o.total_dzd;

/** "Payé en ligne" / "Acompte payé" for orders paid (partly) through Bledify. */
export function PaymentBadge({ o }: { o: Order }) {
  const { t, formatDZD } = useI18n();
  if (!o.amount_online_dzd || o.payment_status === "none") return null;
  const full = o.payment_method === "card";
  const refund = o.payment_status === "refund_due" || o.payment_status === "refunded";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${refund ? "bg-stone-100 text-muted" : "bg-sky-50 text-sky-800"}`}>
      {refund ? t(`pay_status_${o.payment_status}` as "pay_status_refunded")
        : t(full ? "paid_online_badge" : "deposit_paid_badge", { amount: formatDZD(o.amount_online_dzd) })}
    </span>
  );
}
