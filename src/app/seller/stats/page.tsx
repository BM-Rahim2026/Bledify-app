"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Card, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { STATUS_COLOR } from "@/lib/orders";
import type { DictKey } from "@/lib/i18n/dict";

type S = {
  week: number; month: number; total: number; confirmed: number; shipped: number;
  delivered: number; returned: number; revenue_dzd: number; by_status: Record<string, number>;
};

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export default function Stats() {
  const { t, formatDZD } = useI18n();
  const [s, setS] = useState<S | null>(null);
  useEffect(() => { supabase().rpc("seller_stats").then(({ data }) => setS(data as S)); }, []);

  if (!s) return <><PageHeader title={t("stats")} /><div className="py-20 text-center"><Spinner /></div></>;
  const rates = [
    { id: "confirm", label: t("confirm_rate"), a: s.confirmed, b: s.total },
    { id: "deliver", label: t("delivery_rate"), a: s.delivered, b: s.shipped },
    { id: "return", label: t("return_rate"), a: s.returned, b: s.shipped },
  ];
  const max = Math.max(1, ...Object.values(s.by_status));
  return (
    <>
      <PageHeader title={t("stats")} />
      <div className="space-y-4 p-4">
        <h2 className="font-semibold">{t("stats_orders")}</h2>
        <div className="grid grid-cols-2 gap-3">
          <Card data-testid="os-week"><p className="text-3xl font-bold">{s.week}</p><p className="text-sm text-muted">{t("this_week")}</p></Card>
          <Card data-testid="os-month"><p className="text-3xl font-bold">{s.month}</p><p className="text-sm text-muted">{t("this_month")}</p></Card>
        </div>
        {rates.map((r) => (
          <Card key={r.id} data-testid={`os-${r.id}`}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 font-semibold">{r.label}</p>
              <p className="shrink-0 whitespace-nowrap"><span className="text-2xl font-bold">{pct(r.a, r.b)}%</span> <span className="text-sm text-muted" dir="ltr">{r.a}/{r.b}</span></p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand">
              <div className="h-full rounded-full bg-brand" style={{ width: `${pct(r.a, r.b)}%` }} />
            </div>
          </Card>
        ))}
        <Card data-testid="os-revenue">
          <p className="text-sm text-muted">{t("revenue")}</p>
          <p className="text-3xl font-bold text-brand">{formatDZD(s.revenue_dzd)}</p>
        </Card>
        <Card>
          <h3 className="mb-3 font-semibold">{t("by_status")}</h3>
          <ul className="space-y-2">
            {Object.entries(s.by_status).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
              <li key={k} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-2 text-sm">
                <span>{t(`st_${k}` as DictKey)}</span>
                <span className="h-3 overflow-hidden rounded-full bg-sand"><span className={`block h-full rounded-full ${STATUS_COLOR[k]}`} style={{ width: `${(v / max) * 100}%` }} /></span>
                <span className="text-end font-semibold">{v}</span>
              </li>
            ))}
          </ul>
        </Card>
        <p className="text-xs text-muted">{t("stats_note")}</p>
      </div>
    </>
  );
}
