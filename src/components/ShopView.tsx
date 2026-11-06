"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase/client";
import { useSession } from "@/lib/useSession";
import { readCart, writeCart, type Cart } from "@/lib/cart";
import { normalizePhone, waNumber } from "@/lib/format";
import { CAT_TINT } from "@/lib/categories";
import { WILAYAS, wilayaLabel, wilayaValue } from "@/lib/wilayas";
import { PublicHeader } from "@/components/PublicHeader";
import { Button, Card, Field, Input, Select, Spinner, Textarea } from "@/components/ui";
import type { DictKey } from "@/lib/i18n/dict";

export type PublicShop = {
  id: string; name: string; slug: string; description: string; wilaya: string; whatsapp: string; cover: string;
  delivery_home_dzd: number; delivery_desk_dzd: number; delivered_count: number;
  products: { id: string; name: string; description: string; category: string; price_dzd: number; images: string[] }[];
};

export function ShopView({ shop }: { shop: PublicShop }) {
  const { t, lang, formatDZD } = useI18n();
  const user = useSession();
  const path = usePathname();
  const [cart, setCartState] = useState<Cart>({});
  const [f, setF] = useState({ name: "", phone: "", wilaya: "", commune: "", address: "", type: "home" as "home" | "desk", note: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ number: string; total_dzd: number } | null>(null);

  // restore the cart saved before login / from a product page
  useEffect(() => {
    const saved = readCart(shop.slug);
    const valid = Object.fromEntries(Object.entries(saved).filter(([id]) => shop.products.some((p) => p.id === id)));
    queueMicrotask(() => setCartState(valid));
  }, [shop.slug, shop.products]);

  // prefill from the account
  useEffect(() => {
    if (!user) return;
    const m = user.user_metadata ?? {};
    queueMicrotask(() => setF((x) => ({
      ...x, name: x.name || m.full_name || "", phone: x.phone || m.phone || "",
      wilaya: x.wilaya || m.wilaya || "", commune: x.commune || m.commune || "",
    })));
  }, [user]);

  const setCart = (fn: (c: Cart) => Cart) => setCartState((c) => { const n = fn(c); writeCart(shop.slug, n); return n; });
  const qty = (id: string, d: number) => setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(99, (c[id] ?? 0) + d)) }));

  const lines = shop.products.filter((p) => cart[p.id] > 0);
  const subtotal = lines.reduce((s, p) => s + p.price_dzd * cart[p.id], 0);
  const fee = f.type === "desk" ? shop.delivery_desk_dzd : shop.delivery_home_dzd;
  const wilayas = useMemo(() => WILAYAS.map((w) => ({ v: wilayaValue(w), l: wilayaLabel(wilayaValue(w), lang) })), [lang]);
  const next = encodeURIComponent(`${path}#order`);

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
      writeCart(shop.slug, {});
      setDone(body);
      // remember delivery details for next time
      void supabase().auth.updateUser({ data: { full_name: f.name, phone: f.phone, wilaya: f.wilaya, commune: f.commune } });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setErr(t("error"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-dvh">
        <PublicHeader />
        <main className="mx-auto max-w-xl px-4 py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">✓</div>
          <h1 className="font-display text-3xl">{t("order_sent_title")}</h1>
          <p className="mt-3 text-muted">{t("order_sent_body")}</p>
          <p className="my-4 font-mono text-3xl font-bold" dir="ltr">{done.number}</p>
          <p className="text-lg">{t("to_collect")}: <b>{formatDZD(done.total_dzd)}</b></p>
          <div className="mt-8 flex flex-col gap-3">
            <Link href="/orders" className="rounded-xl bg-brand px-5 py-3 font-semibold text-white">{t("my_orders")}</Link>
            <Link href="/" className="rounded-xl border border-line bg-surface px-5 py-3 font-semibold">{t("continue_shopping")}</Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-24 md:pb-10">
      <PublicHeader />
      {/* cover */}
      <section className="relative h-48 overflow-hidden bg-ink md:mx-auto md:mt-4 md:h-64 md:max-w-6xl md:rounded-3xl">
        {shop.cover ? <Image src={shop.cover} alt="" fill priority sizes="100vw" className="object-cover opacity-80" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      </section>
      <div className="mx-auto max-w-6xl px-4">
        <div className="relative -mt-10">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border-4 border-sand bg-brand font-display text-3xl text-white shadow-lg">
            {shop.name.replace(/^(Les|La|Le|L'|Dar|Atelier)\s+/i, "")[0]}
          </span>
          <div className="mt-3">
            <h1 className="font-display text-3xl leading-tight md:text-4xl">{shop.name}</h1>
            <p className="text-sm text-muted">
              {shop.wilaya ? wilayaLabel(shop.wilaya, lang).replace(/^\d+ - /, "") : null}
              {shop.delivered_count > 0 ? <span className="text-ok"> · ✓ {t("delivered_count", { n: shop.delivered_count })}</span> : null}
            </p>
          </div>
        </div>
        {shop.description ? <p className="mt-4 max-w-2xl text-ink/90">{shop.description}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-brand">🏠 {t("handmade")}</span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-ok">💵 {t("cod")}</span>
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-muted">🚚 {t("desk")} {formatDZD(shop.delivery_desk_dzd)} · {t("home")} {formatDZD(shop.delivery_home_dzd)}</span>
          {shop.whatsapp ? (
            <a href={`https://wa.me/${waNumber(shop.whatsapp)}`} target="_blank" rel="noreferrer" className="rounded-full bg-[#25D366]/15 px-2.5 py-1 text-[#128C4B]">💬 WhatsApp</a>
          ) : null}
        </div>

        <div className="mt-8 md:grid md:grid-cols-[1fr_380px] md:gap-8">
          {/* products */}
          <section className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3">
            {shop.products.map((p) => (
              <div key={p.id} className="flex flex-col">
                <Link href={`/p/${p.id}`} className={`relative block aspect-square overflow-hidden rounded-2xl ${CAT_TINT[p.category] ?? "bg-stone-100"}`}>
                  {p.images[0] ? <Image src={p.images[0]} alt={p.name} fill sizes="(max-width: 640px) 50vw, 25vw" className="object-cover" /> : null}
                </Link>
                <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">{p.name}</p>
                <p className="mb-2 font-bold text-brand">{formatDZD(p.price_dzd)}</p>
                <div className="mt-auto">
                {cart[p.id] ? (
                  <div className="flex items-center justify-between rounded-xl border border-brand bg-brand-soft">
                    <button type="button" className="px-3 py-2 text-lg" onClick={() => qty(p.id, -1)} aria-label="-">−</button>
                    <span className="font-bold">{cart[p.id]}</span>
                    <button type="button" className="px-3 py-2 text-lg" onClick={() => qty(p.id, 1)} aria-label="+">+</button>
                  </div>
                ) : (
                  <Button size="sm" variant="secondary" className="w-full" onClick={() => qty(p.id, 1)}>+ {t("add_to_cart")}</Button>
                )}
                </div>
              </div>
            ))}
          </section>

          {/* order */}
          <aside id="order" className="mt-10 scroll-mt-20 md:mt-0">
            <div className="space-y-4 md:sticky md:top-20">
              <h2 className="font-display text-2xl">{t("cart")}</h2>
              <Card className="space-y-1.5 text-sm">
                {lines.length ? lines.map((p) => (
                  <div key={p.id} className="flex justify-between gap-2"><span className="truncate">{p.name} ×{cart[p.id]}</span><span className="shrink-0 whitespace-nowrap">{formatDZD(p.price_dzd * cart[p.id])}</span></div>
                )) : <p className="text-muted">{t("cart_empty")}</p>}
                <div className="flex justify-between text-muted"><span>{t("delivery_fee")} ({t(f.type)})</span><span>{formatDZD(fee)}</span></div>
                <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><span>{t("total")}</span><span className="text-brand">{formatDZD(subtotal + fee)}</span></div>
                <p className="pt-1 text-xs font-semibold text-ok">💵 {t("cod")}</p>
              </Card>

              {user === undefined ? (
                <div className="py-6 text-center"><Spinner /></div>
              ) : !user ? (
                <Card className="space-y-3 border-brand/30 bg-brand-soft/40 text-center">
                  <p className="text-lg font-semibold">🔒 {t("login_to_order")}</p>
                  <p className="text-sm text-muted">{t("login_to_order_sub")}</p>
                  <div className="flex flex-col gap-2">
                    <Link href={`/signup?next=${next}`} className="rounded-xl bg-brand px-4 py-3 font-semibold text-white">{t("signup")}</Link>
                    <Link href={`/login?next=${next}`} className="rounded-xl border border-line bg-surface px-4 py-3 font-semibold">{t("login")}</Link>
                  </div>
                </Card>
              ) : (
                <form onSubmit={submit} className="space-y-4">
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
              )}
            </div>
          </aside>
        </div>

        <footer className="mt-12 border-t border-line py-6 text-center text-sm text-muted">
          <Link href="/" className="font-display text-lg text-brand">Bledify</Link> · <Link href="/track" className="underline">{t("track_order")}</Link>
        </footer>
      </div>

      {/* sticky cart bar on phones */}
      {lines.length ? (
        <a href="#order" className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-between rounded-2xl bg-ink px-4 py-3.5 font-semibold text-white shadow-xl md:hidden">
          <span>🧺 {lines.reduce((n, p) => n + cart[p.id], 0)} · {formatDZD(subtotal)}</span>
          <span>{t("order_now")} →</span>
        </a>
      ) : null}
    </div>
  );
}
