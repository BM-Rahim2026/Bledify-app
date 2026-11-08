"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/useSession";
import { Icon } from "@/components/Icon";
import type { DictKey } from "@/lib/i18n/dict";

const REASONS = {
  product: ["imported", "counterfeit", "prohibited", "wrong_info", "inappropriate", "scam", "other"],
  shop: ["scam", "imported", "inappropriate", "wrong_info", "other"],
  order: ["not_received", "damaged", "not_as_described", "wrong_item", "other"],
} as const;

/** "Signaler" (product / shop) or "Signaler un problème" (order): goes to the Bledify team's queue. */
export function ReportButton({ kind, targetId, className = "", onDone }: { kind: "product" | "shop" | "order"; targetId: string; className?: string; onDone?: () => void }) {
  const { t } = useI18n();
  const user = useSession();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REASONS[kind][0]);
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error" | "already">("idle");
  const label = kind === "order" ? t("report_problem") : t("report");

  if (user === null) return <Link href={`/login?next=${encodeURIComponent(path)}`} className={`inline-flex items-center gap-1 text-xs text-muted underline ${className}`}><Icon name="shield" className="h-3.5 w-3.5" />{label}</Link>;
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    const { error } = await supabase().rpc("submit_report", { p_kind: kind, p_target: targetId, p_reason: reason, p_details: details });
    setState(!error ? "done" : error.message === "ALREADY_REPORTED" ? "already" : "error");
    if (!error) onDone?.();
  }
  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setState("idle"); }} className={`inline-flex items-center gap-1 text-xs font-semibold underline ${kind === "order" ? "text-danger" : "text-muted"} ${className}`}>
        <Icon name="shield" className="h-3.5 w-3.5" />{label}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
          <form onSubmit={send} className="w-full max-w-md space-y-3 rounded-t-3xl bg-surface p-5 shadow-xl sm:rounded-3xl">
            <div className="flex items-center justify-between"><h2 className="font-display text-xl">{label}</h2>
              <button type="button" aria-label={t("close")} onClick={() => setOpen(false)} className="rounded-full p-1 text-muted hover:bg-sand">✕</button></div>
            {state === "done" ? (
              <p className="rounded-xl bg-emerald-50 p-3 text-sm text-ok">{t("report_thanks")}</p>
            ) : (
              <>
                <p className="text-sm text-muted">{kind === "order" ? t("report_order_hint") : t("report_hint")}</p>
                <fieldset className="space-y-1.5">
                  {REASONS[kind].map((r) => (
                    <label key={r} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-2.5 text-sm ${reason === r ? "border-brand bg-brand-soft" : "border-line"}`}>
                      <input type="radio" name="reason" className="accent-brand" checked={reason === r} onChange={() => setReason(r)} />{t(`report_reason_${r}` as DictKey)}
                    </label>
                  ))}
                </fieldset>
                <textarea rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={t("report_details_ph")} dir="auto"
                  className="w-full rounded-xl border border-line px-3 py-2 text-sm" required={reason === "other"} />
                {state === "error" ? <p className="text-sm text-danger">{t("error")}</p> : state === "already" ? <p className="text-sm text-amber-800">{t("report_already")}</p> : null}
                <button type="submit" disabled={state === "busy"} className="w-full rounded-xl bg-brand py-3 font-semibold text-white disabled:opacity-60">{t("report_send")}</button>
              </>
            )}
          </form>
        </div>
      ) : null}
    </>
  );
}
