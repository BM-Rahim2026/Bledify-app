"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import { PAYMENT_STATUSES, SETTABLE, payLabel } from "@/lib/orders";
import { Select, Spinner, StatusPill } from "@/components/ui";
import { Empty, Pill, SearchInput, useAdminRpc } from "@/components/admin/AdminUI";
import type { DictKey } from "@/lib/i18n/dict";

type Row = {
  id: string; number: string; status: string; payment_status: string; payment_method: string; total_dzd: number;
  amount_online_dzd: number; customer_name: string; phone: string; wilaya: string; created_at: string; source: string;
  items_count: number; shop: { id: string; name: string; slug: string };
};

/** Every order on the marketplace. */
export default function AdminOrders() {
  const { t, lang, formatDZD } = useI18n();
  const [q, setQ] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [pay, setPay] = useState("");
  useEffect(() => { queueMicrotask(() => setQ(new URLSearchParams(window.location.search).get("q") ?? "")); }, []);
  const { data } = useAdminRpc<Row[]>("admin_orders", { p_q: q ?? "", p_status: status, p_payment: pay });
  const onSearch = useCallback((v: string) => setQ(v), []);

  if (q === null) return <div className="py-16 text-center"><Spinner /></div>;
  return (
    <div className="space-y-3">
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
      {!data ? <div className="py-16 text-center"><Spinner /></div> : data.length === 0 ? <Empty /> : (
        <ul className="space-y-2">
          {data.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/orders/${o.id}`} className="block rounded-2xl border border-line bg-surface p-3 shadow-sm hover:border-brand/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{o.customer_name} <span className="text-xs font-normal text-muted" dir="ltr">{o.phone}</span></p>
                    <p className="text-xs text-muted" dir="auto"><span dir="ltr">{o.number}</span> · {o.shop.name} · {formatDateTime(o.created_at, lang)}</p>
                  </div>
                  <div className="shrink-0 text-end">
                    <StatusPill status={o.status} />
                    <p className="mt-1 whitespace-nowrap font-bold text-brand">{formatDZD(o.total_dzd)}</p>
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Pill tone={o.payment_status === "paid" ? "ok" : o.payment_status === "refund_due" || o.payment_status === "failed" ? "danger" : o.payment_status === "pending" ? "warn" : "muted"}>
                    {t(payLabel(o.payment_status))}{o.amount_online_dzd ? ` · ${formatDZD(o.amount_online_dzd)}` : ""}
                  </Pill>
                  {o.source === "manual" ? <Pill>{t("source_manual")}</Pill> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
