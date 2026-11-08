"use client";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { Button, Card, Input, Spinner } from "@/components/ui";
import { Empty, Section, adminCall, useAdminRpc } from "@/components/admin/AdminUI";
import type { DictKey } from "@/lib/i18n/dict";

type Data = {
  payouts: { shop_id: string; name: string; slug: string; available: number | null; on_hold: number | null; payout_method: string; payout_account: string; payout_holder: string }[];
  refunds: { id: string; number: string; status: string; amount_online_dzd: number; payment_method: string; customer_name: string; phone: string; shop_name: string; updated_at: string }[];
  recent_payouts: { shop: string; amount_dzd: number; note: string; created_at: string }[];
};

/** Refunds to settle and money to send to shops (the transfer itself is done at the bank / CCP). */
export default function AdminPayments() {
  const { t, lang, formatDZD } = useI18n();
  const { data, reload } = useAdminRpc<Data>("admin_payouts", {});
  const [form, setForm] = useState<Record<string, { amount: string; ref: string }>>({});
  const [err, setErr] = useState<string | null>(null);

  async function pay(shopId: string, max: number) {
    const f = form[shopId] ?? { amount: String(max), ref: "" };
    const ok = await adminCall("admin_record_payout", { p_shop: shopId, p_amount: Math.round(Number(f.amount) || 0), p_reference: f.ref });
    setErr(ok ? null : shopId);
    if (ok) { setForm({ ...form, [shopId]: { amount: "", ref: "" } }); await reload(); }
  }

  if (!data) return <div className="py-16 text-center"><Spinner /></div>;
  return (
    <div className="space-y-6">
      <Section title={t("adm_refunds")}>
        {data.refunds.length === 0 ? <Empty text={t("adm_no_refunds")} /> : (
          <ul className="space-y-2">
            {data.refunds.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/orders/${r.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-danger/30 bg-rose-50/40 p-3">
                  <span className="min-w-0">
                    <span className="block font-semibold"><span dir="ltr">{r.number}</span> · {r.customer_name}</span>
                    <span className="block text-xs text-muted">{r.shop_name} · {t(`st_${r.status}` as DictKey)} · {formatDate(r.updated_at, lang)}</span>
                  </span>
                  <span className="shrink-0 font-bold text-danger">{formatDZD(r.amount_online_dzd)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("adm_payouts")}>
        {data.payouts.length === 0 ? <Empty text={t("adm_no_payouts")} /> : (
          <ul className="space-y-2">
            {data.payouts.map((p) => {
              const avail = p.available ?? 0;
              const f = form[p.shop_id] ?? { amount: avail > 0 ? String(avail) : "", ref: "" };
              return (
                <li key={p.shop_id}>
                  <Card className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={`/admin/shops/${p.shop_id}`} className="font-semibold">{p.name}</Link>
                        <p className="text-xs text-muted" dir="auto">
                          {p.payout_account ? `${t(`payout_${p.payout_method}` as DictKey)} · ${p.payout_account} · ${p.payout_holder}` : t("adm_no_account")}
                        </p>
                      </div>
                      <div className="shrink-0 text-end text-sm">
                        <p className="font-bold text-brand">{formatDZD(avail)}</p>
                        <p className="text-xs text-muted">{t("earnings_on_hold")} {formatDZD(p.on_hold ?? 0)}</p>
                      </div>
                    </div>
                    {avail > 0 ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-[8rem_1fr] gap-2">
                          <Input type="number" min={1} max={avail} aria-label={t("adm_amount")} value={f.amount} onChange={(e) => setForm({ ...form, [p.shop_id]: { ...f, amount: e.target.value } })} />
                          <Input placeholder={t("adm_reference")} value={f.ref} maxLength={120} onChange={(e) => setForm({ ...form, [p.shop_id]: { ...f, ref: e.target.value } })} />
                        </div>
                        <Button size="sm" className="w-full" disabled={!p.payout_account} onClick={() => pay(p.shop_id, avail)}>{t("adm_record_payout")}</Button>
                      </div>
                    ) : null}
                    {err === p.shop_id ? <p className="text-sm text-danger">{t("error")}</p> : null}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title={t("adm_recent_payouts")}>
        {data.recent_payouts.length === 0 ? <Empty /> : (
          <Card>
            <ul className="divide-y divide-line text-sm">
              {data.recent_payouts.map((r, k) => (
                <li key={k} className="flex justify-between gap-3 py-2">
                  <span className="min-w-0"><span className="font-semibold">{r.shop}</span> <span className="text-xs text-muted" dir="auto">{r.note}</span></span>
                  <span className="shrink-0">{formatDZD(r.amount_dzd)} · <span className="text-xs text-muted">{formatDate(r.created_at, lang)}</span></span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </Section>
    </div>
  );
}
