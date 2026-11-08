"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { wilayaLabel } from "@/lib/wilayas";
import { formatDate } from "@/lib/format";
import { ShopLogo, type LogoConfig } from "@/components/ShopLogo";
import { RatingSummary, VerifiedBadge } from "@/components/trust/Trust";
import { Button, Card, Field, Input, Spinner } from "@/components/ui";
import { NotesAndLog, Pill, Section, Stat, adminCall, useAdminRpc } from "@/components/admin/AdminUI";
import type { DictKey } from "@/lib/i18n/dict";

type Shop = {
  id: string; name: string; slug: string; description: string; wilaya: string; phone: string; whatsapp: string;
  status: "pending" | "approved" | "rejected"; application_note: string; review_note: string;
  verified: boolean; verified_at: string | null; suspended: boolean; suspended_reason: string; is_demo: boolean;
  commission_pct: number | null; commission_effective: number; created_at: string; email: string; owner_name: string | null;
  logo?: LogoConfig; logo_url?: string; category?: string | null;
  payout_method: string; payout_account: string; payout_holder: string;
  products: number; products_blocked: number; orders: number; delivered: number; returned: number; sales_dzd: number;
  available: number; on_hold: number; paid_out: number; rating?: number | string | null; review_count?: number;
};

export default function AdminShop() {
  const { id } = useParams<{ id: string }>();
  const { t, lang, formatDZD } = useI18n();
  const { data: s, reload } = useAdminRpc<Shop>("admin_shop", { p_shop: id });
  const [reason, setReason] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [commission, setCommission] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<boolean | null>(null);

  async function patch(p: Record<string, unknown>) {
    setBusy(true); setMsg(null);
    const ok = await adminCall("admin_update_shop", { p_shop: id, p_patch: p });
    setBusy(false); setMsg(ok);
    if (ok) await reload();
  }

  if (!s) return <div className="py-16 text-center"><Spinner /></div>;
  const pct = commission ?? (s.commission_pct == null ? "" : String(s.commission_pct));
  return (
    <div className="space-y-5">
      <Link href="/admin/shops" className="text-sm font-semibold text-brand">← {t("adm_back")}</Link>
      <div className="flex items-center gap-3">
        <ShopLogo name={s.name} logo={s.logo} logoUrl={s.logo_url} category={s.category} size={64} />
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl">{s.name}{s.verified ? <VerifiedBadge /> : null}</h1>
          <p className="text-sm text-muted">{wilayaLabel(s.wilaya, lang).replace(/^\d+ - /, "") || "—"} · {t("adm_joined", { date: formatDate(s.created_at, lang) })}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {s.status === "pending" ? <Pill tone="warn">{t("adm_status_pending")}</Pill> : s.status === "rejected" ? <Pill tone="danger">{t("adm_status_rejected")}</Pill> : null}
            {s.suspended ? <Pill tone="danger">{t("adm_suspended_badge")}{s.suspended_reason ? ` · ${s.suspended_reason}` : ""}</Pill> : null}
            {s.is_demo ? <Pill>{t("adm_demo_badge")}</Pill> : null}
            <RatingSummary rating={s.rating} count={s.review_count} />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-sm font-semibold text-brand">
        <Link href={`/s/${s.slug}`} target="_blank">{t("adm_view_public")} ↗</Link>
        <Link href={`/admin/products?q=${encodeURIComponent(s.name)}`}>{t("adm_see_products")}</Link>
        <Link href={`/admin/orders?q=${encodeURIComponent(s.name)}`}>{t("adm_see_orders")}</Link>
      </div>

      {s.status !== "approved" ? (
        <Card className="space-y-3 border-gold/50 bg-gold-soft/40">
          <h2 className="font-semibold">{t("adm_application")}</h2>
          <p className="whitespace-pre-line text-sm" dir="auto">{s.application_note || "—"}</p>
          {s.description ? <p className="text-sm text-muted" dir="auto">{s.description}</p> : null}
          {s.review_note ? <p className="text-xs text-danger" dir="auto">{s.review_note}</p> : null}
          <Input placeholder={t("adm_review_note")} value={reviewNote} maxLength={300} onChange={(e) => setReviewNote(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" disabled={busy} onClick={() => patch({ status: "approved", review_note: reviewNote })}>{t("adm_approve_shop")}</Button>
            <Button size="sm" variant="danger" disabled={busy || s.status === "rejected"} onClick={() => patch({ status: "rejected", review_note: reviewNote })}>{t("adm_reject_shop")}</Button>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("adm_nav_products")} value={s.products} sub={s.products_blocked ? t("adm_products_blocked_n", { n: s.products_blocked }) : undefined} />
        <Stat label={t("adm_nav_orders")} value={s.orders} sub={t("adm_delivered_n", { n: s.delivered })} />
        <Stat label={t("adm_sales")} value={formatDZD(s.sales_dzd)} />
        <Stat label={t("adm_returns")} value={s.returned} />
      </div>

      <Section title={t("adm_private_contact")}>
        <Card className="space-y-1 text-sm">
          <p><span className="text-muted">{t("adm_owner")} : </span>{s.owner_name || "—"}</p>
          <p><span className="text-muted">{t("adm_email")} : </span><a className="text-brand" href={`mailto:${s.email}`} dir="ltr">{s.email}</a></p>
          <p><span className="text-muted">{t("shop_phone")} : </span><a className="text-brand" href={`tel:${s.phone}`} dir="ltr">{s.phone || "—"}</a></p>
          <p><span className="text-muted">{t("shop_whatsapp")} : </span><span dir="ltr">{s.whatsapp || "—"}</span></p>
        </Card>
      </Section>

      <Section title={t("adm_money")}>
        <Card className="space-y-1 text-sm">
          <p className="flex justify-between"><span className="text-muted">{t("earnings_available")}</span><b>{formatDZD(s.available)}</b></p>
          <p className="flex justify-between"><span className="text-muted">{t("earnings_on_hold")}</span><span>{formatDZD(s.on_hold)}</span></p>
          <p className="flex justify-between"><span className="text-muted">{t("earnings_paid_out")}</span><span>{formatDZD(s.paid_out)}</span></p>
          <p className="border-t border-line pt-1"><span className="text-muted">{t("payout_account")} : </span>
            {s.payout_account ? <span dir="ltr">{t(`payout_${s.payout_method}` as DictKey)} · {s.payout_account} · {s.payout_holder}</span> : t("adm_no_account")}
          </p>
        </Card>
      </Section>

      <Section title={t("adm_actions")}>
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={s.verified ? "secondary" : "primary"} disabled={busy} onClick={() => patch({ verified: !s.verified })}>
              {s.verified ? t("adm_unverify") : t("adm_verify")}
            </Button>
          </div>
          <div className="space-y-2">
            {s.suspended ? (
              <Button size="sm" disabled={busy} onClick={() => patch({ suspended: false, suspended_reason: "" })}>{t("adm_unsuspend")}</Button>
            ) : (
              <>
                <Field label={t("adm_suspend_reason")}><Input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} /></Field>
                <Button size="sm" variant="danger" disabled={busy} onClick={() => patch({ suspended: true, suspended_reason: reason })}>{t("adm_suspend")}</Button>
              </>
            )}
            <p className="text-xs text-muted">{t("adm_suspend_hint")}</p>
          </div>
          <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void patch({ commission_pct: pct }); }}>
            <Field label={t("adm_commission_shop")} hint={t("adm_commission_hint", { pct: Number(s.commission_effective) })}>
              <Input type="number" min={0} max={100} step="0.5" inputMode="decimal" value={pct} onChange={(e) => setCommission(e.target.value)} />
            </Field>
            <Button type="submit" size="sm" disabled={busy}>{t("save")}</Button>
          </form>
          {msg !== null ? <p className={`text-sm ${msg ? "text-ok" : "text-danger"}`}>{t(msg ? "saved" : "error")}</p> : null}
        </Card>
      </Section>
      <NotesAndLog type="shop" id={s.id} logType="shops" />
    </div>
  );
}
