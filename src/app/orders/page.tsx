"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicNav } from "@/components/PublicNav";
import { Card, Spinner, StatusPill } from "@/components/ui";
import type { OrderItem } from "@/lib/orders";
import { Icon } from "@/components/Icon";
import { Stars } from "@/components/trust/Trust";

type MyOrder = {
  id: string; number: string; status: string; items: OrderItem[]; total_dzd: number; created_at: string;
  carrier: string; tracking_number: string; shop_name: string; shop_slug: string; image: string | null;
  reviews?: Record<string, { rating: number; comment: string }>;
};

export default function MyOrders() {
  const { t, lang, formatDZD } = useI18n();
  const [orders, setOrders] = useState<MyOrder[] | null>(null);
  useEffect(() => { supabase().rpc("my_orders").then(({ data }) => setOrders((data ?? []) as MyOrder[])); }, []);

  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-5 font-display text-3xl">{t("my_orders")}</h1>
        {orders === null ? <div className="py-16 text-center"><Spinner /></div> : orders.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-muted">{t("no_my_orders")}</p>
            <Link href="/explore" className="mt-4 inline-block rounded-xl bg-brand px-5 py-3 font-semibold text-white">{t("start_shopping")}</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <Card key={o.id} className="flex gap-3">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-sand">
                  {o.image ? <Image src={o.image} alt="" fill sizes="80px" className="object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-semibold">{o.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}</p>
                    <StatusPill status={o.status} />
                  </div>
                  <p className="text-xs text-muted" dir="auto">
                    <Link href={`/s/${o.shop_slug}`} className="text-brand">{o.shop_name}</Link> · <span dir="ltr">{o.number}</span> · {formatDate(o.created_at, lang)}
                  </p>
                  <p className="mt-1 font-bold">{formatDZD(o.total_dzd)}</p>
                  {o.tracking_number ? <p className="text-xs font-semibold text-amber-800" dir="ltr">{o.carrier} {o.tracking_number}</p> : null}
                  {o.status === "delivered" ? (
                    <div className="mt-3 space-y-2 border-t border-line pt-3">
                      {o.items.filter((i) => i.product_id).map((i) => <ReviewBox key={i.product_id} orderId={o.id} item={i} existing={o.reviews?.[i.product_id!]} />)}
                    </div>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
      <PublicNav />
    </div>
  );
}

/** Stars + comment for one product of a delivered order (submit_review: buyer only, editable). */
function ReviewBox({ orderId, item, existing }: { orderId: string; item: OrderItem; existing?: { rating: number; comment: string } }) {
  const { t } = useI18n();
  const [saved, setSaved] = useState(existing ?? null);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return;
    setBusy(true); setErr(false);
    const { error } = await supabase().rpc("submit_review", { p_order: orderId, p_product: item.product_id, p_rating: rating, p_comment: comment });
    setBusy(false);
    if (error) { setErr(true); return; }
    setSaved({ rating, comment }); setOpen(false);
  }

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="min-w-0 truncate">{item.name}</span>
        {saved ? (
          <button type="button" onClick={() => setOpen(true)} className="flex shrink-0 items-center gap-1.5" aria-label={t("edit_review")}>
            <Stars value={saved.rating} /><Icon name="check" className="h-4 w-4 text-ok" />
          </button>
        ) : (
          <button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-full bg-gold-soft px-3 py-1 text-xs font-semibold text-brand">{t("rate_order")}</button>
        )}
      </div>
    );
  }
  return (
    <form onSubmit={send} className="space-y-2 rounded-xl bg-sand p-3">
      <p className="truncate text-sm font-semibold">{item.name}</p>
      <div className="flex items-center gap-1" role="radiogroup" aria-label={t("your_rating")}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}/5`} onClick={() => setRating(n)} className="p-0.5">
            <Icon name="star" className={`h-8 w-8 ${n <= rating ? "text-gold" : "text-gold/30"}`} fill="currentColor" strokeWidth={0} />
          </button>
        ))}
      </div>
      <textarea rows={2} maxLength={600} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("review_placeholder")}
        className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm" dir="auto" />
      {err ? <p className="text-sm text-danger">{t("error")}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={!rating || busy} className="flex-1 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{t("send_review")}</button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm">{t("cancel")}</button>
      </div>
    </form>
  );
}
