"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useSeller } from "@/lib/seller";
import { errorKey, nextSteps, SETTABLE, type Order, type OrderStatus } from "@/lib/orders";
import { whatsappLink } from "@/lib/whatsapp";
import { Button, Field, Input, Modal, Spinner } from "@/components/ui";
import type { DictKey } from "@/lib/i18n/dict";

export function OrderActions({ order: o, onChange, compact = false }: {
  order: Order; onChange: (o: Order) => void; compact?: boolean;
}) {
  const { t, lang } = useI18n();
  const { shop } = useSeller();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [shipOpen, setShipOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [carrier, setCarrier] = useState(o.carrier);
  const [tracking, setTracking] = useState(o.tracking_number);

  async function run(fn: string, args: Record<string, unknown>) {
    setBusy(true); setErr(null);
    const { data, error } = await supabase().rpc(fn, args);
    setBusy(false);
    if (error) { setErr(t(errorKey(error) as DictKey)); return false; }
    const row = Array.isArray(data) ? data[0] : data;
    if (row) onChange(row as Order);
    return true;
  }

  const setStatus = (s: OrderStatus, c?: string, tr?: string) =>
    run("set_order_status", { p_order: o.id, p_status: s, p_carrier: c ?? null, p_tracking: tr ?? null });
  const callResult = (r: "confirmed" | "no_answer" | "cancelled") => run("record_call", { p_order: o.id, p_result: r });

  function step(s: OrderStatus) {
    if (s === "shipped") { setShipOpen(true); return; }
    void setStatus(s);
  }

  const isNew = o.status === "new" || o.status === "pending";
  return (
    <div className="space-y-2">
      {isNew ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <a href={`tel:${o.phone}`} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-ink px-3 font-semibold text-white">
              📞 {t("call")}
            </a>
            <a href={whatsappLink(o, shop.name, lang)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-3 font-semibold text-white">
              💬 {t("whatsapp")}
            </a>
          </div>
          {o.status === "new" ? (
            <div>
              {!compact ? <p className="mb-1 text-xs font-semibold text-muted">{t("call_result")}</p> : null}
              <div className="grid grid-cols-3 gap-2">
                <Button size="sm" variant="ok" disabled={busy} onClick={() => callResult("confirmed")}>{t("res_confirmed")}</Button>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => callResult("no_answer")}>{t("res_no_answer")}</Button>
                <Button size="sm" variant="danger" disabled={busy} onClick={() => callResult("cancelled")}>{t("res_cancelled")}</Button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {nextSteps(o.status).map((s) => (
          <Button key={s} size="sm" variant={s === "returned" ? "danger" : "primary"} disabled={busy} onClick={() => step(s)}>
            {t(`act_${s}` as DictKey)}
          </Button>
        ))}
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPickOpen(true)}>{t("change_status")}</Button>
        {busy ? <Spinner /> : null}
      </div>
      {err ? <p className="text-xs text-danger" role="alert">{err}</p> : null}

      <Modal open={shipOpen} onClose={() => setShipOpen(false)} title={t("ship_title")}>
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          if (await setStatus("shipped", carrier, tracking)) setShipOpen(false);
        }}>
          <Field label={`${t("carrier")} (${t("optional")})`}>
            <Input value={carrier} onChange={(e) => setCarrier(e.target.value)} list="carriers" />
            <datalist id="carriers">
              {["Yalidine", "ZR Express", "Maystro", "Ecotrack", "NoEST", "GuepEx", "E-com Delivery"].map((c) => <option key={c} value={c} />)}
            </datalist>
          </Field>
          <Field label={`${t("tracking_number")} (${t("optional")})`}>
            <Input dir="ltr" value={tracking} onChange={(e) => setTracking(e.target.value)} />
          </Field>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShipOpen(false)}>{t("cancel")}</Button>
            <Button type="submit" className="flex-1" disabled={busy}>{t("confirm")}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={pickOpen} onClose={() => setPickOpen(false)} title={t("change_status")}>
        <div className="grid grid-cols-2 gap-2">
          {SETTABLE.map((s) => (
            <Button key={s} variant={s === o.status ? "primary" : "secondary"} disabled={busy}
              onClick={async () => {
                setPickOpen(false);
                if (s === "shipped") setShipOpen(true);
                else await setStatus(s);
              }}>
              {t(`st_${s}` as DictKey)}
            </Button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
