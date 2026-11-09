"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { Button, Field, Input, Spinner } from "@/components/ui";
import { Empty, Pill, adminCall, useAdminRpc } from "@/components/admin/AdminUI";

type Banner = {
  id?: number; title_fr: string; title_ar: string; sub_fr: string; sub_ar: string; image: string; href: string;
  position: number; active: boolean; starts_at: string | null; ends_at: string | null; live?: boolean;
};
const blank: Banner = { title_fr: "", title_ar: "", sub_fr: "", sub_ar: "", image: "", href: "/explore", position: 10, active: true, starts_at: null, ends_at: null };

// <input type="datetime-local"> works in local time; the database stores instants.
const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

/** Home carousel slides: image, French / Arabic titles, link, dates. Without any live slide the home keeps its default slides. */
export default function AdminBanners() {
  const { t, lang } = useI18n();
  const { data, reload } = useAdminRpc<Banner[]>("admin_banners", {});
  const [edit, setEdit] = useState<Banner | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  async function upload(files: FileList | null) {
    const f = files?.[0];
    if (!f || !edit) return;
    setBusy(true); setErr(false);
    const { data: u } = await supabase().auth.getUser();
    const ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${u.user?.id}/banner-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase().storage.from("product-images").upload(path, f, { contentType: f.type });
    if (error) setErr(true);
    else setEdit({ ...edit, image: supabase().storage.from("product-images").getPublicUrl(path).data.publicUrl });
    setBusy(false);
  }

  async function save(b: Banner) {
    setBusy(true); setErr(false);
    const { live: _live, ...rest } = b;
    void _live;
    const ok = await adminCall("admin_save_banner", { p: rest });
    setBusy(false);
    if (!ok) { setErr(true); return; }
    setEdit(null);
    await reload();
  }

  async function remove(id: number) {
    if (!confirm(t("adm_banner_delete_confirm"))) return;
    if (await adminCall("admin_delete_banner", { p_id: id })) await reload();
  }

  if (!data) return <div className="py-16 text-center"><Spinner /></div>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl">{t("adm_nav_banners")}</h1>
          <p className="text-sm text-muted">{t("adm_banners_hint")}</p>
        </div>
        {edit ? null : <Button size="sm" onClick={() => setEdit({ ...blank })}>+ {t("adm_banner_new")}</Button>}
      </div>

      {edit ? (
        <form onSubmit={(e) => { e.preventDefault(); void save(edit); }} className="space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div className="relative aspect-[16/7] overflow-hidden rounded-xl bg-sand">
            {edit.image ? <img src={edit.image} alt="" className="h-full w-full object-cover" /> : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 text-white" dir={lang === "ar" ? "rtl" : "ltr"}>
              <p className="font-display text-2xl leading-tight">{(lang === "ar" ? edit.title_ar : edit.title_fr) || t("adm_banner_title_fr")}</p>
              <p className="text-sm opacity-90">{lang === "ar" ? edit.sub_ar : edit.sub_fr}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex min-h-9 cursor-pointer items-center rounded-xl border border-line px-3 text-sm font-semibold hover:bg-sand">
              {busy ? <Spinner /> : t("adm_banner_upload")}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void upload(e.target.files)} />
            </label>
            <span className="text-xs text-muted">{t("adm_banner_size")}</span>
          </div>
          <Field label={t("adm_banner_image_url")}><Input required dir="ltr" value={edit.image} onChange={(e) => setEdit({ ...edit, image: e.target.value.trim() })} /></Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t("adm_banner_title_fr")}><Input required maxLength={120} value={edit.title_fr} onChange={(e) => setEdit({ ...edit, title_fr: e.target.value })} /></Field>
            <Field label={t("adm_banner_title_ar")}><Input required maxLength={120} dir="rtl" value={edit.title_ar} onChange={(e) => setEdit({ ...edit, title_ar: e.target.value })} /></Field>
            <Field label={t("adm_banner_sub_fr")}><Input maxLength={200} value={edit.sub_fr} onChange={(e) => setEdit({ ...edit, sub_fr: e.target.value })} /></Field>
            <Field label={t("adm_banner_sub_ar")}><Input maxLength={200} dir="rtl" value={edit.sub_ar} onChange={(e) => setEdit({ ...edit, sub_ar: e.target.value })} /></Field>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t("adm_banner_link")} hint={t("adm_banner_link_hint")}>
              <Input required dir="ltr" pattern="/.*" value={edit.href} onChange={(e) => setEdit({ ...edit, href: e.target.value.trim() })} />
            </Field>
            <Field label={t("offer_position")}><Input type="number" value={edit.position} onChange={(e) => setEdit({ ...edit, position: Number(e.target.value) || 0 })} /></Field>
            <Field label={t("adm_banner_starts")}><Input type="datetime-local" value={toLocal(edit.starts_at)} onChange={(e) => setEdit({ ...edit, starts_at: fromLocal(e.target.value) })} /></Field>
            <Field label={t("adm_banner_ends")}><Input type="datetime-local" value={toLocal(edit.ends_at)} onChange={(e) => setEdit({ ...edit, ends_at: fromLocal(e.target.value) })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="h-5 w-5 accent-brand" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
            {t("adm_banner_active")}
          </label>
          {err ? <p className="text-sm text-danger">{t("error")}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !edit.image}>{t("save")}</Button>
            <Button type="button" variant="secondary" onClick={() => { setEdit(null); setErr(false); }}>{t("cancel")}</Button>
          </div>
        </form>
      ) : null}

      {data.length === 0 ? <Empty text={t("adm_banners_empty")} /> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.map((b) => (
            <li key={b.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="relative aspect-[16/7] bg-sand">
                <img src={b.image} alt="" className="h-full w-full object-cover" />
                <span className="absolute start-2 top-2">
                  <Pill tone={b.live ? "ok" : b.active ? "warn" : "muted"}>{t(b.live ? "adm_banner_live" : b.active ? "adm_banner_scheduled" : "adm_banner_off")}</Pill>
                </span>
              </div>
              <div className="space-y-1 p-3">
                <p className="font-semibold">{lang === "ar" ? b.title_ar : b.title_fr}</p>
                <p className="truncate text-xs text-muted" dir="ltr">{b.href} · #{b.position}</p>
                {b.starts_at || b.ends_at ? (
                  <p className="text-xs text-muted">{b.starts_at ? formatDate(b.starts_at, lang) : "…"} → {b.ends_at ? formatDate(b.ends_at, lang) : "…"}</p>
                ) : null}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="secondary" onClick={() => setEdit(b)}>{t("edit")}</Button>
                  <Button size="sm" variant="secondary" onClick={() => void save({ ...b, active: !b.active })}>{t(b.active ? "adm_banner_pause" : "adm_banner_resume")}</Button>
                  <Button size="sm" variant="danger" onClick={() => void remove(b.id!)}>{t("delete")}</Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
