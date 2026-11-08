"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Spinner } from "@/components/ui";
import { AuditList, Chips, useAdminRpc, type AuditRow } from "@/components/admin/AdminUI";

type F = "" | "shops" | "products" | "orders" | "reports" | "users" | "offer_entries" | "seller_ledger" | "platform_settings";

/** Who did what in the admin console (written by the database, cannot be edited). */
export default function AdminJournal() {
  const { t } = useI18n();
  const [f, setF] = useState<F>("");
  const { data } = useAdminRpc<AuditRow[]>("admin_audit_log", { p_type: f, p_target: "", p_limit: 300 });
  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl">{t("adm_nav_journal")}</h1>
      <p className="text-sm text-muted">{t("adm_journal_hint")}</p>
      <Chips value={f} onChange={setF} options={[
        { key: "", label: t("all") }, { key: "shops", label: t("adm_nav_shops") }, { key: "products", label: t("adm_nav_products") },
        { key: "orders", label: t("adm_nav_orders") }, { key: "reports", label: t("adm_nav_reports") }, { key: "users", label: t("adm_nav_customers") },
        { key: "offer_entries", label: t("adm_nav_offers") }, { key: "seller_ledger", label: t("adm_nav_payments") }, { key: "platform_settings", label: t("adm_nav_settings") }]} />
      {!data ? <div className="py-16 text-center"><Spinner /></div> : <div className="rounded-2xl border border-line bg-surface p-3"><AuditList rows={data} showTarget /></div>}
    </div>
  );
}
