"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { TABS, type Order } from "@/lib/orders";
import { normalizePhone } from "@/lib/format";
import { Button, Empty, Input, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { OrderCard } from "@/components/OrderCard";
import type { DictKey } from "@/lib/i18n/dict";

const PAGE = 30;

async function fetchCounts(): Promise<Record<string, number>> {
  const { data } = await supabase().rpc("seller_stats");
  const b = (data?.by_status ?? {}) as Record<string, number>;
  const g = (k: string) => b[k] ?? 0;
  return {
    all: Object.values(b).reduce((a, x) => a + x, 0),
    new: g("new") + g("pending"), confirmed: g("confirmed") + g("ready"),
    shipped: g("shipped"), delivered: g("delivered"), cancelled: g("cancelled"), returned: g("returned"),
  };
}

function OrdersInner() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const tab = (params.get("status") as (typeof TABS)[number]) || "all";
  const [q, setQ] = useState(params.get("q") ?? "");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [more, setMore] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = useCallback(async (offset = 0) => {
    let query = supabase().from("orders_view").select("*").order("created_at", { ascending: false }).range(offset, offset + PAGE - 1);
    if (tab === "new") query = query.in("status", ["new", "pending"]);
    else if (tab === "confirmed") query = query.in("status", ["confirmed", "ready"]);
    else if (tab !== "all") query = query.eq("status", tab);
    const term = q.trim().replace(/[,()%*]/g, " ").trim();
    if (term) {
      const ph = normalizePhone(term);
      const ors = [`customer_name.ilike.*${term}*`, `number.ilike.*${term}*`, `phone.ilike.*${term.replace(/\s/g, "")}*`];
      if (ph) ors.push(`phone.eq.${ph}`);
      query = query.or(ors.join(","));
    }
    const { data } = await query;
    const rows = (data ?? []) as Order[];
    setOrders((cur) => (offset === 0 ? rows : [...(cur ?? []), ...rows]));
    setMore(rows.length === PAGE);
  }, [tab, q]);

  const loadCounts = useCallback(() => fetchCounts().then(setCounts), []);

  useEffect(() => {
    const id = setTimeout(() => { void load(0); }, q ? 250 : 0);
    return () => clearTimeout(id);
  }, [load, q]);
  useEffect(() => { fetchCounts().then(setCounts); }, []);

  function onChange(o: Order) {
    setOrders((cur) => (cur ?? []).map((x) => (x.id === o.id ? o : x))
      .filter((x) => tab === "all" || x.id !== o.id || x.status === tab || (tab === "new" && x.status === "pending")));
    void loadCounts();
  }

  const confirmedIds = (orders ?? []).filter((o) => o.status === "confirmed").map((o) => o.id);

  return (
    <>
      <PageHeader title={t("orders")} action={
        <Link href="/seller/orders/new" className="rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white">+ {t("new_order")}</Link>
      } />
      <div className="space-y-3 p-4">
        <Input type="search" placeholder={t("search_orders")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("search_orders")} />
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist">
          {TABS.map((k) => (
            <button key={k} role="tab" aria-selected={tab === k}
              onClick={() => router.replace(k === "all" ? "/seller/orders" : `/seller/orders?status=${k}`)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${tab === k ? "bg-ink text-white" : "border border-line bg-surface text-ink"}`}>
              {k === "all" ? t("tab_all") : t(`st_${k}` as DictKey)} ({counts[k] ?? 0})
            </button>
          ))}
        </div>
        {tab === "confirmed" && confirmedIds.length ? (
          <Link href={`/seller/labels?ids=${confirmedIds.join(",")}`} className="block text-sm font-semibold text-brand underline">
            🖨 {t("print_labels_confirmed")} ({confirmedIds.length})
          </Link>
        ) : null}
        {orders === null ? <div className="py-10 text-center"><Spinner /></div>
          : orders.length === 0 ? <Empty>{t("no_orders")}</Empty>
          : orders.map((o) => <OrderCard key={o.id} order={o} onChange={onChange} />)}
        {more ? <Button variant="secondary" className="w-full" onClick={() => load(orders?.length ?? 0)}>{t("load_more")}</Button> : null}
      </div>
    </>
  );
}

export default function OrdersPage() {
  return <Suspense><OrdersInner /></Suspense>;
}
