"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import { payLabel } from "@/lib/orders";
import { Button, Spinner } from "@/components/ui";
import { Chips, Empty, Pill, adminCall, useAdminRpc } from "@/components/admin/AdminUI";
import type { DictKey } from "@/lib/i18n/dict";

type R = {
  id: number; kind: "product" | "shop" | "order"; target_id: string; reason: string; details: string; status: "open" | "resolved" | "dismissed";
  resolution: string; resolved_by: string; created_at: string; reporter: { id: string | null; email: string | null };
  shop: { id: string; name: string; slug: string } | null; shop_reports: number;
  target: { name: string; image?: string; blocked?: boolean; suspended?: boolean; status?: string; payment_status?: string; total_dzd?: number } | null;
};
type S = "open" | "resolved" | "dismissed" | "";
type K = "" | "product" | "shop" | "order";

/** Trust & safety queue: buyer reports on products and shops, and problems reported on orders (disputes). */
export default function AdminReports() {
  const { t, lang, formatDZD } = useI18n();
  const [status, setStatus] = useState<S>("open");
  const [kind, setKind] = useState<K>("");
  const { data, reload } = useAdminRpc<R[]>("admin_reports", { p_status: status, p_kind: kind });
  const [notes, setNotes] = useState<Record<number, string>>({});
  async function resolve(r: R, st: "resolved" | "dismissed" | "open") {
    if (await adminCall("admin_resolve_report", { p_report: r.id, p_status: st, p_resolution: notes[r.id] ?? "" })) await reload();
  }
  async function blockProduct(r: R) {
    if (await adminCall("admin_set_product_blocked", { p_product: r.target_id, p_blocked: true, p_reason: t(`report_reason_${r.reason}` as DictKey) })) await resolve(r, "resolved");
  }
  const targetLink = (r: R) => r.kind === "product" ? `/p/${r.target_id}` : r.kind === "order" ? `/admin/orders/${r.target_id}` : `/admin/shops/${r.target_id}`;
  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl">{t("adm_nav_reports")}</h1>
      <p className="text-sm text-muted">{t("adm_reports_hint")}</p>
      <Chips value={status} onChange={setStatus} options={[{ key: "open", label: t("adm_report_open") }, { key: "resolved", label: t("adm_report_resolved") }, { key: "dismissed", label: t("adm_report_dismissed") }, { key: "", label: t("all") }]} />
      <Chips value={kind} onChange={setKind} options={[{ key: "", label: t("all") }, { key: "order", label: t("adm_kind_order") }, { key: "product", label: t("adm_kind_product") }, { key: "shop", label: t("adm_kind_shop") }]} />
      {!data ? <div className="py-16 text-center"><Spinner /></div> : data.length === 0 ? <Empty /> : (
        <ul className="space-y-3">
          {data.map((r) => (
            <li key={r.id} className={`rounded-2xl border bg-surface p-3 shadow-sm ${r.kind === "order" && r.status === "open" ? "border-danger/40" : "border-line"}`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <Pill tone={r.kind === "order" ? "danger" : "warn"}>{t(`adm_kind_${r.kind}` as DictKey)}</Pill>
                <b>{t(`report_reason_${r.reason}` as DictKey)}</b>
                <span className="text-xs text-muted">· {formatDateTime(r.created_at, lang)} · <span dir="ltr">{r.reporter.email ?? "—"}</span></span>
              </div>
              <div className="mt-2 flex gap-3">
                {r.target?.image ? <img src={r.target.image} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" /> : null}
                <div className="min-w-0 text-sm">
                  <Link href={targetLink(r)} target={r.kind === "product" ? "_blank" : undefined} className="font-semibold hover:text-brand" dir="auto">{r.target?.name ?? "—"}</Link>
                  {r.kind === "order" && r.target ? <p className="text-xs text-muted">{t(`st_${r.target.status}` as DictKey)} · {t(payLabel(r.target.payment_status ?? "none"))} · {formatDZD(r.target.total_dzd ?? 0)}</p> : null}
                  {r.shop ? <p className="text-xs"><Link href={`/admin/shops/${r.shop.id}`} className="text-brand">{r.shop.name}</Link> <span className="text-muted">· {r.shop_reports === 1 ? t("adm_shop_reports_one") : t("adm_shop_reports", { n: r.shop_reports })}</span></p> : null}
                  {r.target?.blocked ? <Pill tone="danger">{t("adm_blocked_badge")}</Pill> : null}
                  {r.details ? <p className="mt-1 whitespace-pre-line rounded-lg bg-ivory p-2" dir="auto">{r.details}</p> : null}
                </div>
              </div>
              {r.status === "open" ? (
                <div className="mt-3 space-y-2">
                  <input value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} placeholder={t("adm_resolution_ph")} dir="auto" className="w-full rounded-xl border border-line px-3 py-2 text-sm" />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => resolve(r, "resolved")}>{t("adm_resolve")}</Button>
                    <Button size="sm" variant="secondary" onClick={() => resolve(r, "dismissed")}>{t("adm_dismiss")}</Button>
                    {r.kind === "product" && !r.target?.blocked ? <Button size="sm" variant="danger" onClick={() => blockProduct(r)}>{t("adm_block_and_resolve")}</Button> : null}
                    {r.kind !== "product" && r.shop ? <Link href={`/admin/shops/${r.shop.id}`} className="inline-flex items-center rounded-xl border border-line px-3 text-sm font-semibold">{t("adm_open_shop")}</Link> : null}
                    {r.kind === "order" ? <Link href={`/admin/orders/${r.target_id}`} className="inline-flex items-center rounded-xl border border-line px-3 text-sm font-semibold">{t("adm_open_order")}</Link> : null}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted" dir="auto">{t(`adm_report_${r.status}` as DictKey)} · {r.resolved_by}{r.resolution ? ` · ${r.resolution}` : ""}
                  {" "}<button type="button" className="font-semibold text-brand underline" onClick={() => resolve(r, "open")}>{t("adm_reopen")}</button></p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
