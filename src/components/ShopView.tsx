"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n, LangSwitch } from "@/lib/i18n";
import { normalizePhone, waNumber } from "@/lib/format";
import { WILAYAS, wilayaLabel, wilayaValue } from "@/lib/wilayas";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import type { DictKey } from "@/lib/i18n/dict";

export type PublicShop = {
  id: string; name: string; slug: string; description: string; wilaya: string; whatsapp: string;
  delivery_home_dzd: number; delivery_desk_dzd: number; delivered_count: number;
  products: { id: string; name: string; description: string; price_dzd: number; images: string[] }[];
};

export function ShopView({ shop }: { shop: PublicShop }) {
  const { t, lang, formatDZD } = useI18n();
  const [cart, setCart] = useState<Record<string, number>>(shop.products.length === 1 ? { [shop.products[0].id]: 1 } : {});
  const [f, setF] = useState({ name: "", phone: "", wilaya: "", commune: "", address: "", type: "home" as "home" | "desk", note: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ number: string; total_dzd: number } | null>(null);

  const lines = shop.products.filter((p) => cart[p.id] > 0);
  const subtotal = lines.reduce((s, p) => s + p.price_dzd * cart[p.id], 0);
  const fee = f.type === "desk" ? shop.delivery_desk_dzd : shop.delivery_home_dzd;
  const qty = (id: string, d: number) => setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(99, (c[id] ?? 0) + d)) }));
  const wilayas = useMemo(() => WILAYAS.map((w) => ({ v: wilayaValue(w), l: wilayaLabel(wilayaValue(w), lang) })), [lang]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!lines.length) { setErr(t("cart_empty")); return; }
    if (!normalizePhone(f.phone)) { setErr(t("err_phone")); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: shop.slug, customer_name: f.name, phone: f.phone, wilaya: f.wilaya, commune: f.commune,
          address: f.address, delivery_type: f.type, note: f.note,
          items: lines.map((p) => ({ product_id: p.id, quantity: cart[p.id] })),
        }),
      });
      const body = await res.json();
      if (!res.ok) { setErr(t((body.error as DictKey) || "error")); return; }
      setDone(body);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setErr(t("error"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">✓</div>
        <h1 className="font-display text-3xl">{t("order_sent_title")}</h1>
        <p className="mt-3 text-muted">{t("order_sent_body")}</p>
        <p className="my-4 font-mono text-3xl font-bold" dir="ltr">{done.number}</p>
        <p className="text-lg">{t("to_collect")}: <b>{formatDZD(done.total_dzd)}</b></p>
        <p className="mt-6 text-sm text-muted">{t("track_hint")}</p>
        <Link href={`/track?n=${done.number}`} className="mt-3 inline-block rounded-xl bg-brand px-5 py-3 font-semibold text-white">{t("track_order")}</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl pb-10">
      <header className="flex items-center justify-between px-4 py-4">
        <div>
          <h1 className="font-display text-3xl">{shop.name}</h1>
          <p className="text-sm text-muted">
            {shop.wilaya ? wilayaLabel(shop.wilaya, lang) : null}
            {shop.delivered_count > 0 ? ` · ✓ ${t("delivered_count", { n: shop.delivered_count })}` : null}
          </p>
        </div>
        <LangSwitch />
      </header>
      {shop.description ? <p className="px-4 pb-4">{shop.description}</p> : null}

      <section className="grid grid-cols-2 gap-3 px-4">
        {shop.products.map((p) => (
          <Card key={p.id} className="flex flex-col overflow-hidden p-0">
            <div className="aspect-square bg-sand">
              {p.images[0] ? <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" loading="lazy" /> : null}
            </div>
            <div className="flex flex-1 flex-col p-3">
              <p className="line-clamp-2 font-semibold">{p.name}</p>
              <p className="mb-2 font-bold text-brand">{formatDZD(p.price_dzd)}</p>
              <div className="mt-auto">
                {cart[p.id] ? (
                  <div className="flex items-center justify-between rounded-xl border border-line">
                    <button type="button" className="px-3 py-2 text-lg" onClick={() => qty(p.id, -1)} aria-label="-">−</button>
                    <span className="font-bold">{cart[p.id]}</span>
                    <button type="button" className="px-3 py-2 text-lg" onClick={() => qty(p.id, 1)} aria-label="+">+</button>
                  </div>
                ) : (
                  <Button size="sm" className="w-full" onClick={() => qty(p.id, 1)}>{t("add_to_cart")}</Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </section>

      <form onSubmit={submit} className="mt-6 space-y-4 px-4" id="order">
        <h2 className="font-display text-2xl">{t("cart")}</h2>
        <Card className="space-y-1 text-sm">
          {lines.length ? lines.map((p) => (
            <div key={p.id} className="flex justify-between"><span>{p.name} ×{cart[p.id]}</span><span>{formatDZD(p.price_dzd * cart[p.id])}</span></div>
          )) : <p className="text-muted">{t("cart_empty")}</p>}
          <div className="flex justify-between text-muted"><span>{t("delivery_fee")} ({t(f.type)})</span><span>{formatDZD(fee)}</span></div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><span>{t("total")}</span><span className="text-brand">{formatDZD(subtotal + fee)}</span></div>
          <p className="pt-1 text-xs font-semibold text-ok">💵 {t("cod")}</p>
        </Card>
        <Field label={t("customer_name")}><Input required minLength={2} maxLength={80} autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label={t("phone")}><Input required type="tel" inputMode="tel" dir="ltr" autoComplete="tel" placeholder="0661 23 45 67" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label={t("wilaya")}>
          <Select required value={f.wilaya} onChange={(e) => setF({ ...f, wilaya: e.target.value })}>
            <option value="">{t("choose_wilaya")}</option>
            {wilayas.map((w) => <option key={w.v} value={w.v}>{w.l}</option>)}
          </Select>
        </Field>
        <Field label={t("commune")}><Input required value={f.commune} onChange={(e) => setF({ ...f, commune: e.target.value })} /></Field>
        <fieldset>
          <legend className="mb-1 text-sm font-semibold">{t("delivery")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["home", "desk"] as const).map((k) => (
              <label key={k} className={`cursor-pointer rounded-xl border p-3 text-sm ${f.type === k ? "border-brand bg-brand-soft" : "border-line bg-surface"}`}>
                <input type="radio" name="type" className="sr-only" checked={f.type === k} onChange={() => setF({ ...f, type: k })} />
                <span className="block font-semibold">{t(k)}</span>
                <span className="text-muted">{formatDZD(k === "desk" ? shop.delivery_desk_dzd : shop.delivery_home_dzd)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {f.type === "home" ? <Field label={t("address")}><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field> : null}
        <Field label={`${t("note")} (${t("optional")})`}><Textarea rows={2} maxLength={500} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        {err ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-danger" role="alert">{err}</p> : null}
        <Button type="submit" className="w-full text-lg" disabled={busy}>{busy ? t("sending") : `${t("place_order")} · ${formatDZD(subtotal + fee)}`}</Button>
      </form>

      <footer className="mt-10 space-y-2 px-4 text-center text-sm text-muted">
        {shop.whatsapp ? <p><a className="text-brand underline" href={`https://wa.me/${waNumber(shop.whatsapp)}`} target="_blank" rel="noreferrer">{t("contact_seller")}</a></p> : null}
        <p><Link href="/track" className="underline">{t("track_order")}</Link></p>
        <p>{t("powered_by")}</p>
      </footer>
    </main>
  );
}
