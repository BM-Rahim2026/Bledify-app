"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { offerTitle, type Offer } from "@/lib/offers";
import { Icon } from "@/components/Icon";
import { Button, Field, Input, Select, Spinner } from "@/components/ui";

type AdminOffer = Offer & { pending: number; approved: number };
const ICONS = ["gift", "occasions", "moon", "sun", "heart", "star", "food", "fashion", "crafts", "home", "terroir", "beauty", "jewelry"];
const blank: Omit<Offer, "position"> & { position: number } = { slug: "", kind: "special", title_fr: "", title_ar: "", image: "", icon: "gift", position: 10, active: true };

/** The team creates offers (seasonal or special), edits them and opens / closes them. */
export default function ManageOffers() {
  const { t, lang } = useI18n();
  const [offers, setOffers] = useState<AdminOffer[] | null>(null);
  const [edit, setEdit] = useState<(typeof blank & { isNew: boolean }) | null>(null);
  const [err, setErr] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase().rpc("admin_offers");
    setOffers((data ?? []) as AdminOffer[]);
  }, []);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  async function save(o: Omit<Offer, never>) {
    setErr(false);
    const { error } = await supabase().rpc("admin_save_offer", { p_offer: o });
    if (error) { setErr(true); return false; }
    await load();
    return true;
  }

  if (!offers) return <div className="py-16 text-center"><Spinner /></div>;
  return (
    <div className="space-y-4">
      {edit ? (
        <form onSubmit={async (e) => { e.preventDefault(); if (await save(edit)) setEdit(null); }} className="space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="font-semibold">{edit.isNew ? t("offer_new") : t("offer_edit")}</h2>
          <Field label={t("offer_slug")} hint={t("offer_slug_hint")}>
            <Input required dir="ltr" pattern="[a-z0-9][a-z0-9\-]{1,30}" disabled={!edit.isNew} value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value.toLowerCase() })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("offer_kind")}>
              <Select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as Offer["kind"] })}>
                <option value="seasonal">{t("offer_kind_seasonal")}</option>
                <option value="special">{t("offer_kind_special")}</option>
              </Select>
            </Field>
            <Field label={t("offer_position")}><Input type="number" value={edit.position} onChange={(e) => setEdit({ ...edit, position: Number(e.target.value) || 0 })} /></Field>
          </div>
          <Field label={t("offer_title_fr")}><Input required minLength={2} maxLength={60} value={edit.title_fr} onChange={(e) => setEdit({ ...edit, title_fr: e.target.value })} /></Field>
          <Field label={t("offer_title_ar")}><Input required minLength={2} maxLength={60} dir="rtl" value={edit.title_ar} onChange={(e) => setEdit({ ...edit, title_ar: e.target.value })} /></Field>
          <Field label={t("offer_image")}><Input dir="ltr" value={edit.image} onChange={(e) => setEdit({ ...edit, image: e.target.value.trim() })} /></Field>
          <div>
            <p className="mb-1 text-sm font-semibold">{t("offer_icon")}</p>
            <div className="flex flex-wrap gap-1.5">
              {ICONS.map((i) => (
                <button key={i} type="button" aria-label={i} aria-pressed={edit.icon === i} onClick={() => setEdit({ ...edit, icon: i })}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border ${edit.icon === i ? "border-brand bg-brand text-white" : "border-line bg-surface text-brand"}`}>
                  <Icon name={i} className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-brand" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />{t("offer_active")}</label>
          {err ? <p className="text-sm text-danger">{t("error")}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">{t("save")}</Button>
            <Button type="button" variant="secondary" onClick={() => { setEdit(null); setErr(false); }}>{t("cancel")}</Button>
          </div>
        </form>
      ) : (
        <Button onClick={() => setEdit({ ...blank, isNew: true })}>+ {t("offer_new")}</Button>
      )}

      <ul className="space-y-3">
        {offers.map((o) => (
          <li key={o.slug} className={`flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-sm ${o.active ? "" : "opacity-60"}`}>
            <span className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-sand">
              {o.image ? <img src={o.image} alt="" className="h-full w-full object-cover" /> : null}
              <span className="absolute start-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-brand"><Icon name={o.icon} className="h-3.5 w-3.5" /></span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{offerTitle(o, lang)}</span>
              <span className="block text-xs text-muted" dir="ltr">/{o.slug} · {t(o.kind === "special" ? "offer_kind_special" : "offer_kind_seasonal")}</span>
              <span className="block text-xs text-muted">{t("admin_counts", { pending: o.pending, approved: o.approved })}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold">
                <input type="checkbox" className="h-5 w-5 accent-brand" checked={o.active} onChange={(e) => void save({ ...o, active: e.target.checked })} />
                {t("offer_active")}
              </label>
              <button type="button" className="text-xs font-semibold text-brand underline" onClick={() => setEdit({ ...o, isNew: false })}>{t("offer_edit")}</button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
