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

type MyOrder = {
  id: string; number: string; status: string; items: OrderItem[]; total_dzd: number; created_at: string;
  carrier: string; tracking_number: string; shop_name: string; shop_slug: string; image: string | null;
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
