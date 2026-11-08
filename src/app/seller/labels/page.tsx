"use client";
import { Suspense, useEffect, useState } from "react";
import { toCollect } from "@/components/PaymentBadge";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useSeller } from "@/lib/seller";
import { prettyPhone } from "@/lib/format";
import { wilayaLabel } from "@/lib/wilayas";
import type { Order } from "@/lib/orders";
import { Button, Spinner } from "@/components/ui";

function Labels() {
  const { t, lang, formatDZD } = useI18n();
  const { shop } = useSeller();
  const ids = (useSearchParams().get("ids") ?? "").split(",").filter(Boolean).slice(0, 100);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const key = ids.join(",");

  useEffect(() => {
    if (!key) return;
    supabase().from("orders").select("*").in("id", key.split(",")).then(({ data }) => setOrders((data ?? []) as Order[]));
  }, [key]);

  const shown = key ? orders : [];
  if (!shown) return <div className="py-20 text-center"><Spinner /></div>;
  return (
    <div className="bg-white p-4">
      <div className="no-print mb-4 flex gap-2">
        <Button onClick={() => window.print()}>🖨 {t("print")}</Button>
        <Button variant="secondary" onClick={() => history.back()}>{t("back")}</Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 print:block">
        {shown.map((o) => (
          <section key={o.id} className="break-inside-avoid rounded-lg border-2 border-black p-4 text-black print:mb-[6mm] print:break-after-page">
            <div className="flex items-center justify-between border-b border-black pb-2">
              <span className="font-display text-xl">{shop.name}</span>
              <span className="font-mono text-lg font-bold" dir="ltr">{o.number}</span>
            </div>
            <p className="mt-3 text-2xl font-bold">{o.customer_name}</p>
            <p className="font-mono text-2xl font-bold" dir="ltr">{prettyPhone(o.phone)}</p>
            <p className="mt-2 text-lg font-semibold">{wilayaLabel(o.wilaya, lang)}{o.commune ? ` — ${o.commune}` : ""}</p>
            <p>{t(o.delivery_type)}{o.address ? ` · ${o.address}` : ""}</p>
            <p className="mt-2 text-sm">{o.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}</p>
            {o.tracking_number ? <p className="text-sm" dir="ltr">{o.carrier} {o.tracking_number}</p> : null}
            <div className="mt-3 flex items-center justify-between border-t border-black pt-2">
              <span className="font-semibold">{t("to_collect")}</span>
              <span className="text-3xl font-bold">{toCollect(o) ? formatDZD(toCollect(o)) : t("nothing_to_collect")}</span>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export default function LabelsPage() {
  return <Suspense><Labels /></Suspense>;
}
