"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useSeller } from "@/lib/seller";
import { formatDate } from "@/lib/format";
import { Button, Card, Field, Input, Select, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/Icon";
import type { DictKey } from "@/lib/i18n/dict";

type Balance = {
  on_hold: number; available: number; paid_out: number; commission_pct: number; payout_delay_days: number;
  payout_method: string; payout_account: string; payout_holder: string;
  entries: { kind: string; amount_dzd: number; available_at: string; created_at: string; note: string }[];
};

/** The shop's money: Bledify collects every payment and pays the shop after delivery. */
export default function Earnings() {
  const { t, lang, formatDZD } = useI18n();
  const { shop, reloadShop } = useSeller();
  const [b, setB] = useState<Balance | null>(null);
  const [acct, setAcct] = useState({ payout_method: "", payout_account: "", payout_holder: "" });
  const [saved, setSaved] = useState<boolean | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    supabase().rpc("seller_balance").then(({ data }) => {
      const x = data as Balance | null;
      setB(x); setNow(Date.now());
      if (x) setAcct({ payout_method: x.payout_method, payout_account: x.payout_account, payout_holder: x.payout_holder });
    });
  }, []);

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!shop) return;
    const { error } = await supabase().from("shops").update(acct).eq("id", shop.id);
    setSaved(!error);
    if (!error) await reloadShop();
  }

  if (!b) return <><PageHeader title={t("earnings")} /><div className="py-16 text-center"><Spinner /></div></>;
  return (
    <>
      <PageHeader title={t("earnings")} />
      <div className="space-y-4 p-4">
        <p className="text-sm text-muted">{t("earnings_sub")}</p>
        <div className="grid grid-cols-2 gap-3">
          <Card className="col-span-2 border-brand/30 bg-brand-soft/40">
            <p className="text-sm text-muted">{t("earnings_available")}</p>
            <p className="mt-1 text-3xl font-bold text-brand">{formatDZD(b.available)}</p>
            <p className="text-xs text-muted">{t("earnings_available_sub")}</p>
          </Card>
          <Card>
            <p className="text-sm text-muted">{t("earnings_on_hold")}</p>
            <p className="mt-1 text-xl font-bold">{formatDZD(b.on_hold)}</p>
            <p className="text-xs text-muted">{t("earnings_on_hold_sub", { days: b.payout_delay_days })}</p>
          </Card>
          <Card>
            <p className="text-sm text-muted">{t("earnings_paid_out")}</p>
            <p className="mt-1 text-xl font-bold">{formatDZD(b.paid_out)}</p>
          </Card>
        </div>
        <p className="flex gap-1.5 text-xs text-muted"><Icon name="shield" className="h-4 w-4 shrink-0 text-brand" />{t("earnings_commission", { pct: Number(b.commission_pct) })}</p>

        <Card>
          <h2 className="mb-2 font-semibold">{t("earnings_history")}</h2>
          {b.entries.length ? (
            <ul className="divide-y divide-line text-sm">
              {b.entries.map((e, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block font-semibold">{t(`ledger_${e.kind}` as DictKey)} <span className="font-normal text-muted" dir="ltr">{e.note}</span></span>
                    <span className="block text-xs text-muted">
                      {formatDate(e.created_at, lang)}
                      {new Date(e.available_at).getTime() > now && e.kind !== "payout" ? ` · ${t("ledger_available_on", { date: formatDate(e.available_at, lang) })}` : ""}
                    </span>
                  </span>
                  <span className={`shrink-0 whitespace-nowrap font-semibold ${e.amount_dzd < 0 ? "text-danger" : "text-ok"}`} dir="ltr">
                    {e.amount_dzd < 0 ? "−" : "+"}{formatDZD(Math.abs(e.amount_dzd))}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">{t("earnings_empty")}</p>}
        </Card>

        <Card>
          <form onSubmit={saveAccount} className="space-y-3">
            <h2 className="font-semibold">{t("payout_account")}</h2>
            <p className="flex gap-1.5 text-xs text-muted"><Icon name="shield" className="h-4 w-4 shrink-0 text-brand" />{t("payout_account_hint")}</p>
            <Field label={t("payout_method")}>
              <Select value={acct.payout_method} onChange={(e) => setAcct({ ...acct, payout_method: e.target.value })}>
                <option value="">—</option>
                <option value="ccp">{t("payout_ccp")}</option>
                <option value="baridimob">{t("payout_baridimob")}</option>
                <option value="rib">{t("payout_rib")}</option>
              </Select>
            </Field>
            <Field label={t("payout_number")}><Input dir="ltr" maxLength={60} value={acct.payout_account} onChange={(e) => setAcct({ ...acct, payout_account: e.target.value })} /></Field>
            <Field label={t("payout_holder")}><Input maxLength={80} value={acct.payout_holder} onChange={(e) => setAcct({ ...acct, payout_holder: e.target.value })} /></Field>
            {saved !== null ? <p className={`text-sm ${saved ? "text-ok" : "text-danger"}`}>{t(saved ? "saved" : "error")}</p> : null}
            <Button type="submit" className="w-full">{t("save")}</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
