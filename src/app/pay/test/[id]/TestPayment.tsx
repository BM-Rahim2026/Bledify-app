"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Logo } from "@/components/Logo";

export function TestPayment({ orderId }: { orderId: string }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  async function go(ok: boolean) {
    setBusy(true);
    await fetch("/api/payments/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ order_id: orderId, ok }) });
    window.location.href = ok ? `/orders?paid=${orderId}` : `/orders?payfail=${orderId}`;
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo height={32} />
      <h1 className="font-display text-2xl">{t("test_payment_title")}</h1>
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t("test_payment_note")}</p>
      <button disabled={busy} onClick={() => go(true)} className="w-full rounded-xl bg-brand px-4 py-3 font-semibold text-white">{t("test_pay_ok")}</button>
      <button disabled={busy} onClick={() => go(false)} className="w-full rounded-xl border border-line bg-surface px-4 py-3 font-semibold">{t("test_pay_fail")}</button>
    </main>
  );
}
