"use client";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { wilayaLabel } from "@/lib/wilayas";
import { formatDate } from "@/lib/format";
import { ShopLogo, type LogoConfig } from "@/components/ShopLogo";
import { VerifiedBadge } from "@/components/trust/Trust";
import { Spinner } from "@/components/ui";
import { Chips, DataTable, Pill, SearchInput, useAdminRpc, type Col } from "@/components/admin/AdminUI";

type Row = {
  id: string; name: string; slug: string; wilaya: string; verified: boolean; suspended: boolean; is_demo: boolean;
  status: "pending" | "approved" | "rejected"; created_at: string; email: string; phone: string; logo?: LogoConfig; logo_url?: string; category?: string | null;
  products: number; orders: number; delivered: number;
};
type F = "" | "pending" | "rejected" | "unverified" | "verified" | "suspended" | "demo";

export default function AdminShops() {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const [f, setF] = useState<F | null>(null);
  useEffect(() => { queueMicrotask(() => setF((new URLSearchParams(window.location.search).get("f") as F | null) ?? "")); }, []);
  const { data } = useAdminRpc<Row[]>("admin_shops", { p_q: q, p_filter: f ?? "" });
  const onSearch = useCallback((v: string) => setQ(v), []);
  const wil = (s: Row) => wilayaLabel(s.wilaya, lang).replace(/^\d+ - /, "") || "—";
  const cols: Col<Row>[] = [
    { key: "name", label: t("shop_name"), sort: (s) => s.name.toLowerCase(), csv: (s) => s.name, render: (s) => (
      <span className="flex items-center gap-2"><ShopLogo name={s.name} logo={s.logo} logoUrl={s.logo_url} category={s.category} size={32} />
        <span className="min-w-0"><span className="flex items-center gap-1">{s.name}{s.verified ? <VerifiedBadge compact /> : null}</span>
          <span className="block text-xs font-normal text-muted" dir="ltr">{s.email}</span></span></span>) },
    { key: "status", label: t("status"), sort: (s) => s.status + (s.suspended ? "z" : ""), csv: (s) => s.suspended ? "suspended" : s.status, render: (s) => (
      <span className="flex flex-wrap gap-1">
        {s.status === "pending" ? <Pill tone="warn">{t("adm_status_pending")}</Pill> : s.status === "rejected" ? <Pill tone="danger">{t("adm_status_rejected")}</Pill> : <Pill tone="ok">{t("adm_status_approved")}</Pill>}
        {s.suspended ? <Pill tone="danger">{t("adm_suspended_badge")}</Pill> : null}{s.is_demo ? <Pill>{t("adm_demo_badge")}</Pill> : null}
      </span>) },
    { key: "wilaya", label: t("wilaya"), sort: wil, csv: wil, render: wil },
    { key: "phone", label: t("shop_phone"), csv: (s) => s.phone, render: (s) => <span dir="ltr">{s.phone || "—"}</span> },
    { key: "products", label: t("adm_nav_products"), sort: (s) => s.products, csv: (s) => s.products, render: (s) => s.products, className: "text-end" },
    { key: "orders", label: t("adm_nav_orders"), sort: (s) => s.orders, csv: (s) => s.orders, render: (s) => `${s.orders} (${s.delivered})`, className: "text-end" },
    { key: "created", label: t("adm_created"), sort: (s) => s.created_at, csv: (s) => s.created_at.slice(0, 10), render: (s) => <span className="whitespace-nowrap">{formatDate(s.created_at, lang)}</span> },
  ];
  if (f === null) return <div className="py-16 text-center"><Spinner /></div>;
  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl">{t("adm_nav_shops")}</h1>
      <SearchInput onSearch={onSearch} />
      <Chips value={f} onChange={setF} options={[
        { key: "", label: t("all") }, { key: "pending", label: t("adm_f_pending") }, { key: "rejected", label: t("adm_f_rejected") }, { key: "unverified", label: t("adm_f_unverified") },
        { key: "verified", label: t("adm_f_verified") }, { key: "suspended", label: t("adm_f_suspended") }, { key: "demo", label: t("adm_f_demo") }]} />
      {!data ? <div className="py-16 text-center"><Spinner /></div> : <DataTable rows={data} cols={cols} rowKey={(s) => s.id} href={(s) => `/admin/shops/${s.id}`} filename="boutiques" />}
    </div>
  );
}
