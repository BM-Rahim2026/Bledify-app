"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { wilayaLabel } from "@/lib/wilayas";
import { formatDate } from "@/lib/format";
import { ShopLogo, type LogoConfig } from "@/components/ShopLogo";
import { VerifiedBadge } from "@/components/trust/Trust";
import { Spinner } from "@/components/ui";
import { Chips, Empty, Pill, SearchInput, useAdminRpc } from "@/components/admin/AdminUI";

type Row = {
  id: string; name: string; slug: string; wilaya: string; verified: boolean; suspended: boolean; is_demo: boolean;
  status: "pending" | "approved" | "rejected"; created_at: string; email: string; phone: string; logo?: LogoConfig; logo_url?: string; category?: string | null;
  products: number; orders: number; delivered: number;
};
type F = "" | "pending" | "rejected" | "unverified" | "verified" | "suspended" | "demo";

export default function AdminShops() {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const [f, setF] = useState<F>("");
  useEffect(() => { const v = new URLSearchParams(window.location.search).get("f") as F | null; if (v) queueMicrotask(() => setF(v)); }, []);
  const { data } = useAdminRpc<Row[]>("admin_shops", { p_q: q, p_filter: f });

  return (
    <div className="space-y-3">
      <SearchInput onSearch={setQ} />
      <Chips value={f} onChange={setF} options={[
        { key: "", label: t("all") }, { key: "pending", label: t("adm_f_pending") }, { key: "rejected", label: t("adm_f_rejected") }, { key: "unverified", label: t("adm_f_unverified") }, { key: "verified", label: t("adm_f_verified") },
        { key: "suspended", label: t("adm_f_suspended") }, { key: "demo", label: t("adm_f_demo") }]} />
      {!data ? <div className="py-16 text-center"><Spinner /></div> : data.length === 0 ? <Empty /> : (
        <ul className="space-y-2">
          {data.map((s) => (
            <li key={s.id}>
              <Link href={`/admin/shops/${s.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-sm hover:border-brand/40">
                <ShopLogo name={s.name} logo={s.logo} logoUrl={s.logo_url} category={s.category} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5 font-semibold">
                    <span className="truncate">{s.name}</span>{s.verified ? <VerifiedBadge compact /> : null}
                    {s.status === "pending" ? <Pill tone="warn">{t("adm_status_pending")}</Pill> : s.status === "rejected" ? <Pill tone="danger">{t("adm_status_rejected")}</Pill> : null}
                    {s.suspended ? <Pill tone="danger">{t("adm_suspended_badge")}</Pill> : null}
                    {s.is_demo ? <Pill>{t("adm_demo_badge")}</Pill> : null}
                  </span>
                  <span className="block truncate text-xs text-muted" dir="ltr">{s.email}{s.phone ? ` · ${s.phone}` : ""}</span>
                  <span className="block text-xs text-muted">
                    {wilayaLabel(s.wilaya, lang).replace(/^\d+ - /, "") || "—"} · {t("adm_products_n", { n: s.products })} · {t("adm_orders_n", { n: s.orders })} · {formatDate(s.created_at, lang)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
