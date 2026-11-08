"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { slugify } from "@/lib/format";
import { WILAYAS, wilayaValue, wilayaLabel } from "@/lib/wilayas";
import type { Shop } from "@/lib/seller";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { ZoneEditor } from "@/components/ZoneEditor";
import { defaultZones, ZONES, type DeliveryZones, type ZoneRate } from "@/lib/delivery";

type Draft = Omit<Shop, "id" | "owner_id" | "created_at" | "logo" | "logo_url" | "verified">;

export function ShopForm({ shop, ownerId, defaultEmail, onSaved }: {
  shop?: Shop; ownerId: string; defaultEmail?: string; onSaved: () => Promise<void> | void;
}) {
  const { t, lang } = useI18n();
  const [d, setD] = useState<Draft>({
    name: shop?.name ?? "", slug: shop?.slug ?? "", description: shop?.description ?? "",
    phone: shop?.phone ?? "", whatsapp: shop?.whatsapp ?? "", wilaya: shop?.wilaya ?? "",
    delivery_home_dzd: shop?.delivery_home_dzd ?? 600, delivery_desk_dzd: shop?.delivery_desk_dzd ?? 400,
    notify_email: shop?.notify_email ?? defaultEmail ?? "", notify_new_orders: shop?.notify_new_orders ?? true,
    delivery_zones: shop?.delivery_zones ?? defaultZones(shop?.delivery_home_dzd ?? 600, shop?.delivery_desk_dzd ?? 400),
  });
  const [slugTouched, setSlugTouched] = useState(Boolean(shop));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    // flat fees = the cheapest zone (used for "Livraison dès …")
    const zones: DeliveryZones = Object.fromEntries(ZONES.map((z) => [z, d.delivery_zones?.[z]]).filter(([, v]) => v));
    const open = Object.values(zones).filter((z): z is ZoneRate => Boolean(z && !z.off));
    const flat = open.length ? { delivery_home_dzd: Math.min(...open.map((z) => z.home)), delivery_desk_dzd: Math.min(...open.map((z) => z.desk)) } : {};
    const row = { ...d, ...flat, delivery_zones: zones, slug: slugify(d.slug || d.name), owner_id: ownerId };
    const sb = supabase();
    const { error } = shop
      ? await sb.from("shops").update(row).eq("id", shop.id)
      : await sb.from("shops").insert(row);
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.code === "23505" ? t("slug_taken") : t("error") });
      return;
    }
    setMsg({ ok: true, text: t("saved") });
    await onSaved();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label={t("shop_name")}>
        <Input required minLength={2} maxLength={80} value={d.name} onChange={(e) => {
          set("name", e.target.value);
          if (!slugTouched) set("slug", slugify(e.target.value));
        }} />
      </Field>
      <Field label={t("shop_slug")} hint={`/s/${slugify(d.slug || d.name) || "…"}`}>
        <Input required pattern="[a-z0-9][a-z0-9\-]{1,38}[a-z0-9]" dir="ltr" value={d.slug}
          onChange={(e) => { setSlugTouched(true); set("slug", e.target.value.toLowerCase()); }} />
      </Field>
      <Field label={t("shop_description")}>
        <Textarea rows={2} value={d.description} onChange={(e) => set("description", e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("shop_phone")}><Input type="tel" dir="ltr" value={d.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label={t("shop_whatsapp")}><Input type="tel" dir="ltr" value={d.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></Field>
      </div>
      <Field label={t("shop_wilaya")}>
        <Select value={d.wilaya} onChange={(e) => set("wilaya", e.target.value)}>
          <option value="">{t("choose_wilaya")}</option>
          {WILAYAS.map((w) => <option key={w.code} value={wilayaValue(w)}>{wilayaLabel(wilayaValue(w), lang)}</option>)}
        </Select>
      </Field>
      <ZoneEditor value={d.delivery_zones ?? {}} onChange={(z) => set("delivery_zones", z)} />
      <Field label={t("notify_email")}>
        <Input type="email" dir="ltr" value={d.notify_email} onChange={(e) => set("notify_email", e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={d.notify_new_orders} onChange={(e) => set("notify_new_orders", e.target.checked)} className="h-5 w-5 accent-brand" />
        {t("notify_new_orders")}
      </label>
      {msg ? <p className={`text-sm ${msg.ok ? "text-ok" : "text-danger"}`} role="status">{msg.text}</p> : null}
      <Button type="submit" disabled={busy} className="w-full">{shop ? t("save") : t("create")}</Button>
    </form>
  );
}
