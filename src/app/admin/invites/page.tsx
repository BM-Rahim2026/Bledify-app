"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { wilayaLabel } from "@/lib/wilayas";
import { toast } from "@/components/Toast";
import { Button, Card, Field, Input, Spinner } from "@/components/ui";
import { Chips, DataTable, Empty, Pill, Section, Stat, adminCall, useAdminRpc, type Col } from "@/components/admin/AdminUI";
import { supabase } from "@/lib/supabase/client";

type Settings = { invite_only: boolean; member_invite_quota: number; members: number; pending_requests: number };
type Invite = { id: number; code: string; by_team: boolean; max_uses: number; uses: number; note: string; expires_at: string | null;
  revoked: boolean; created_at: string; usable: boolean; creator_email: string | null; joined: number };
type Req = { id: number; full_name: string; contact: string; wilaya: string; role: "buyer" | "seller"; message: string;
  status: string; created_at: string; code: string | null };
const show = (c: string) => `${c.slice(0, 4)}-${c.slice(4)}`;

/** Invite-only access: the switch, codes for the team, members' codes and access requests. */
export default function AdminInvites() {
  const { t, lang } = useI18n();
  const { data: st, reload: reloadSt } = useAdminRpc<Settings>("admin_invite_settings", {});
  const [reqStatus, setReqStatus] = useState("pending");
  const { data: reqs, reload: reloadReqs } = useAdminRpc<Req[]>("admin_access_requests", { p_status: reqStatus });
  const [source, setSource] = useState("");
  const { data: invites, reload: reloadInv } = useAdminRpc<Invite[]>("admin_invites", { p_status: "", p_source: source });
  const [batch, setBatch] = useState({ count: 1, uses: 1, note: "", days: "30" });
  const [fresh, setFresh] = useState<string[]>([]);
  const [quota, setQuota] = useState<string | null>(null);

  const link = (c: string) => `${window.location.origin}/i/${show(c)}`;
  const wa = (c: string, phone?: string) => {
    const text = encodeURIComponent(t("myinv_share_text", { link: link(c), code: show(c) }));
    const p = (phone ?? "").replace(/\D/g, "").replace(/^0/, "213");
    return `https://wa.me/${/^213\d{9}$/.test(p) ? p : ""}?text=${text}`;
  };
  const copy = async (s: string) => { await navigator.clipboard.writeText(s); toast(t("myinv_copied")); };

  if (!st) return <div className="py-16 text-center"><Spinner /></div>;
  const cols: Col<Invite>[] = [
    { key: "code", label: t("adm_inv_code"), render: (i) => <span className="font-mono font-semibold" dir="ltr">{show(i.code)}</span>, csv: (i) => show(i.code) },
    { key: "src", label: t("adm_inv_source"), render: (i) => i.by_team ? <Pill tone="brand">{t("adm_inv_team")}</Pill> : <span className="text-xs">{i.creator_email}</span>, csv: (i) => i.by_team ? "team" : i.creator_email ?? "" },
    { key: "uses", label: t("adm_inv_uses"), render: (i) => `${i.uses} / ${i.max_uses}`, sort: (i) => i.uses, csv: (i) => i.uses },
    { key: "note", label: t("note"), render: (i) => <span className="text-xs">{i.note}</span>, csv: (i) => i.note },
    { key: "state", label: t("status"), render: (i) => <Pill tone={i.usable ? "ok" : i.revoked ? "danger" : "muted"}>{t(i.usable ? "adm_inv_usable" : i.revoked ? "adm_inv_revoked" : "adm_inv_done")}</Pill>,
      csv: (i) => (i.usable ? "usable" : i.revoked ? "revoked" : "done") },
    { key: "date", label: t("date"), render: (i) => formatDate(i.created_at, lang), sort: (i) => i.created_at, csv: (i) => i.created_at },
    { key: "act", label: "", render: (i) => i.usable ? (
      <span className="flex gap-1">
        <Button size="sm" variant="secondary" onClick={(e) => { e.preventDefault(); void copy(link(i.code)); }}>{t("myinv_copy")}</Button>
        <Button size="sm" variant="danger" onClick={async (e) => { e.preventDefault(); if (await adminCall("admin_revoke_invite", { p_id: i.id })) { toast(t("adm_inv_revoked")); await reloadInv(); } }}>{t("adm_inv_revoke")}</Button>
      </span>) : null },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">{t("adm_nav_invites")}</h1>
        <p className="text-sm text-muted">{t("adm_inv_hint")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={t("adm_inv_mode")} value={st.invite_only ? t("adm_inv_on") : t("adm_inv_off")} />
        <Stat label={t("adm_inv_members")} value={st.members} />
        <Stat label={t("adm_inv_requests")} value={st.pending_requests} />
      </div>

      <Section title={t("adm_inv_settings")}>
        <Card className="space-y-4">
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-brand" checked={st.invite_only} onChange={async (e) => {
              const on = e.target.checked;
              if (!on && !confirm(t("adm_inv_open_confirm"))) return;
              if (await adminCall("admin_save_invite_settings", { p_invite_only: on, p_quota: null })) { toast(t("saved")); await reloadSt(); }
            }} />
            <span><span className="block font-semibold">{t("adm_inv_switch")}</span><span className="text-sm text-muted">{t("adm_inv_switch_hint")}</span></span>
          </label>
          <form className="flex items-end gap-2" onSubmit={async (e) => {
            e.preventDefault();
            if (await adminCall("admin_save_invite_settings", { p_invite_only: null, p_quota: Number(quota) })) { toast(t("saved")); setQuota(null); await reloadSt(); }
          }}>
            <Field label={t("adm_inv_quota")} hint={t("adm_inv_quota_hint")}>
              <Input type="number" min={0} max={100} value={quota ?? String(st.member_invite_quota)} onChange={(e) => setQuota(e.target.value)} />
            </Field>
            <Button type="submit" size="sm" disabled={quota === null}>{t("save")}</Button>
          </form>
        </Card>
      </Section>

      <Section title={t("adm_inv_requests")}>
        <Chips value={reqStatus} onChange={setReqStatus} options={[
          { key: "pending", label: t("adm_inv_req_pending") }, { key: "invited", label: t("adm_inv_req_invited") },
          { key: "declined", label: t("adm_inv_req_declined") }, { key: "", label: t("all") }]} />
        {!reqs ? <Spinner /> : reqs.length === 0 ? <Empty /> : (
          <ul className="grid gap-3 md:grid-cols-2">
            {reqs.map((r) => (
              <li key={r.id} className="space-y-2 rounded-2xl border border-line bg-surface p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{r.full_name}</span>
                  <Pill tone={r.role === "seller" ? "brand" : "muted"}>{t(r.role === "seller" ? "inv_role_seller" : "inv_role_buyer")}</Pill>
                  <span className="ms-auto text-xs text-muted">{formatDate(r.created_at, lang)}</span>
                </div>
                <p dir="ltr" className="text-start">{r.contact}</p>
                {r.wilaya ? <p className="text-muted">{wilayaLabel(r.wilaya, lang)}</p> : null}
                {r.message ? <p className="rounded-xl bg-sand p-2">{r.message}</p> : null}
                {r.code ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold" dir="ltr">{show(r.code)}</span>
                    <a href={wa(r.code, r.contact)} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center rounded-xl bg-[#25D366] px-3 font-semibold text-white">WhatsApp</a>
                    <Button size="sm" variant="secondary" onClick={() => void copy(link(r.code!))}>{t("myinv_copy")}</Button>
                  </div>
                ) : r.status === "pending" ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={async () => {
                      const { data, error } = await supabase().rpc("admin_invite_request", { p_id: r.id });
                      if (error) { toast(t("error"), "error"); return; }
                      toast(t("adm_inv_req_done", { code: show(String(data)) }));
                      await Promise.all([reloadReqs(), reloadSt(), reloadInv()]);
                    }}>{t("adm_inv_req_accept")}</Button>
                    <Button size="sm" variant="danger" onClick={async () => { if (await adminCall("admin_decline_request", { p_id: r.id })) { await reloadReqs(); await reloadSt(); } }}>{t("adm_inv_req_decline")}</Button>
                  </div>
                ) : <Pill>{t("adm_inv_req_declined")}</Pill>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("adm_inv_create")}>
        <Card className="space-y-3">
          <form className="grid gap-3 sm:grid-cols-4" onSubmit={async (e) => {
            e.preventDefault();
            const { data, error } = await supabase().rpc("admin_create_invites", {
              p_count: batch.count, p_max_uses: batch.uses, p_note: batch.note.trim(), p_days: batch.days ? Number(batch.days) : null });
            if (error) { toast(t("error"), "error"); return; }
            setFresh(data as string[]); toast(t("adm_inv_created", { n: (data as string[]).length })); await reloadInv();
          }}>
            <Field label={t("adm_inv_count")}><Input type="number" min={1} max={200} value={batch.count} onChange={(e) => setBatch({ ...batch, count: Number(e.target.value) || 1 })} /></Field>
            <Field label={t("adm_inv_per_code")} hint={t("adm_inv_per_code_hint")}><Input type="number" min={1} max={10000} value={batch.uses} onChange={(e) => setBatch({ ...batch, uses: Number(e.target.value) || 1 })} /></Field>
            <Field label={t("adm_inv_days")} hint={t("adm_inv_days_hint")}><Input type="number" min={1} max={365} value={batch.days} onChange={(e) => setBatch({ ...batch, days: e.target.value })} /></Field>
            <Field label={t("note")}><Input maxLength={200} placeholder={t("adm_inv_note_ph")} value={batch.note} onChange={(e) => setBatch({ ...batch, note: e.target.value })} /></Field>
            <div className="sm:col-span-4"><Button type="submit">{t("adm_inv_generate")}</Button></div>
          </form>
          {fresh.length ? (
            <div className="space-y-2 rounded-2xl bg-brand-soft/50 p-3">
              <div className="flex flex-wrap gap-2">
                {fresh.map((c) => <button key={c} type="button" onClick={() => void copy(link(c))} className="rounded-lg bg-surface px-2 py-1 font-mono font-semibold" dir="ltr">{show(c)}</button>)}
              </div>
              <Button size="sm" variant="secondary" onClick={() => void copy(fresh.map(link).join("\n"))}>{t("adm_inv_copy_all")}</Button>
            </div>
          ) : null}
        </Card>
      </Section>

      <Section title={t("adm_inv_list")}>
        <Chips value={source} onChange={setSource} options={[{ key: "", label: t("all") }, { key: "team", label: t("adm_inv_team") }, { key: "members", label: t("adm_inv_by_members") }]} />
        {!invites ? <Spinner /> : invites.length === 0 ? <Empty /> : <DataTable rows={invites} cols={cols} rowKey={(i) => String(i.id)} filename="invitations" />}
      </Section>
    </div>
  );
}
