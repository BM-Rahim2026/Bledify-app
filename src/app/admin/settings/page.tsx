"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { Button, Card, Field, Input, Spinner } from "@/components/ui";
import { Pill, Section, adminCall, useAdminRpc } from "@/components/admin/AdminUI";

type Settings = {
  commission_pct: number; payout_delay_days: number; unpaid_expiry_minutes: number; me: string;
  admins: { email: string; since: string }[]; admin_emails: { email: string; confirmed: boolean }[];
};

/** Platform rules and the Bledify team. */
export default function AdminSettings() {
  const { t, lang } = useI18n();
  const { data, reload } = useAdminRpc<Settings>("admin_settings", {});
  const [form, setForm] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<boolean | null>(null);

  if (!data) return <div className="py-16 text-center"><Spinner /></div>;
  const val = (k: "commission_pct" | "payout_delay_days" | "unpaid_expiry_minutes") => form[k] ?? String(data[k]);
  const emails = Array.from(new Set([...data.admins.map((a) => a.email.toLowerCase()), ...data.admin_emails.map((e) => e.email)]));

  return (
    <div className="space-y-6">
      <Section title={t("adm_platform")}>
        <Card>
          <form className="space-y-3" onSubmit={async (e) => {
            e.preventDefault();
            const ok = await adminCall("admin_save_settings", { p_settings: { commission_pct: Number(val("commission_pct")), payout_delay_days: Number(val("payout_delay_days")), unpaid_expiry_minutes: Number(val("unpaid_expiry_minutes")) } });
            setMsg(ok); if (ok) { setForm({}); await reload(); }
          }}>
            <Field label={t("adm_commission_pct")}><Input type="number" min={0} max={100} step="0.5" value={val("commission_pct")} onChange={(e) => setForm({ ...form, commission_pct: e.target.value })} /></Field>
            <Field label={t("adm_payout_delay")}><Input type="number" min={0} max={90} value={val("payout_delay_days")} onChange={(e) => setForm({ ...form, payout_delay_days: e.target.value })} /></Field>
            <Field label={t("adm_unpaid_expiry")}><Input type="number" min={10} max={10080} value={val("unpaid_expiry_minutes")} onChange={(e) => setForm({ ...form, unpaid_expiry_minutes: e.target.value })} /></Field>
            {msg !== null ? <p className={`text-sm ${msg ? "text-ok" : "text-danger"}`}>{t(msg ? "saved" : "error")}</p> : null}
            <Button type="submit" className="w-full">{t("save")}</Button>
          </form>
        </Card>
      </Section>

      <Section title={t("adm_admins")}>
        <Card className="space-y-3">
          <p className="text-xs text-muted">{t("adm_admins_hint")}</p>
          <ul className="divide-y divide-line text-sm">
            {emails.map((e) => {
              const acct = data.admins.find((a) => a.email.toLowerCase() === e);
              const pending = data.admin_emails.find((x) => x.email === e);
              const me = e === data.me?.toLowerCase();
              return (
                <li key={e} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold" dir="ltr">{e}{me ? ` (${t("adm_you")})` : ""}</span>
                    <span className="block text-xs text-muted">{acct ? formatDate(acct.since, lang) : null}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {acct || pending?.confirmed ? <Pill tone="ok">{t("adm_confirmed")}</Pill> : <Pill tone="warn">{t("adm_not_confirmed")}</Pill>}
                    {me ? null : <button type="button" className="text-xs font-semibold text-danger underline" onClick={async () => { if (await adminCall("admin_remove_admin_email", { p_email: e })) await reload(); }}>{t("adm_remove")}</button>}
                  </span>
                </li>
              );
            })}
          </ul>
          <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (email.includes("@") && await adminCall("admin_add_admin_email", { p_email: email })) { setEmail(""); await reload(); } }}>
            <Input type="email" dir="ltr" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit">{t("adm_add")}</Button>
          </form>
        </Card>
      </Section>
    </div>
  );
}
