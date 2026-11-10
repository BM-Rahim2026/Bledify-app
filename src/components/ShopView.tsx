"use client";
import Image from "next/image";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase/client";
import { useSession } from "@/lib/useSession";
import { readCart, writeCart, type Cart } from "@/lib/cart";
import { normalizePhone } from "@/lib/format";
import { CAT_TINT } from "@/lib/categories";
import { WILAYAS, wilayaLabel, wilayaValue } from "@/lib/wilayas";
import { useLocation } from "@/lib/location";
import { PublicHeader } from "@/components/PublicHeader";
import { ShopLogo, type LogoConfig } from "@/components/ShopLogo";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ReportButton } from "@/components/ReportButton";
import { Logo } from "@/components/Logo";
import { Button, Card, Field, Input, Select, Spinner, Textarea } from "@/components/ui";
import type { DictKey } from "@/lib/i18n/dict";
import { minFee, quote, type DeliveryZones } from "@/lib/delivery";
import { allowedMethods, splitPayment, type PayMethod } from "@/lib/payments";
import { RatingSummary, ReviewList, VerifiedBadge, type Review } from "@/components/trust/Trust";

export type PublicShop = {
  id: string; name: string; slug: string; description: string; wilaya: string; cover: string;
  logo?: LogoConfig; logo_url?: string; category?: string | null;
  delivery_home_dzd: number; delivery_desk_dzd: number; delivered_count: number;
  delivery_zones?: DeliveryZones | null; verified?: boolean;
  rating?: number | string | null; review_count?: number; reviews?: Review[];
  products: { id: string; name: string; description: string; category: string; price_dzd: number; images: string[]; pay_cod?: boolean; pay_card?: boolean; deposit_pct?: number }[];
};

export function ShopView({ shop, paymentsOn = false }: { shop: PublicShop; paymentsOn?: boolean }) {
  const { t, lang, formatDZD } = useI18n();
  const user = useSession();
  const path = usePathname();
  const [cart, setCartState] = useState<Cart>({});
  const [f, setF] = useState({ name: "", phone: "", wilaya: "", commune: "", address: "", type: "home" as "home" | "desk", note: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ number: string; total_dzd: number; payment_error?: boolean } | null>(null);
  const [payPick, setPayPick] = useState<PayMethod>("cod");
  const [cardType, setCardType] = useState<"edahabia" | "cib">("edahabia");
  const [redirecting, setRedirecting] = useState(false);

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

  // otherwise, the wilaya from the person's location (GPS or chosen), so the delivery price shows at once
  const { loc } = useLocation();
  useEffect(() => {
    const w = loc && loc.source !== "ip" ? WILAYAS.find((x) => x.code === loc.code) : undefined;
    if (w) queueMicrotask(() => setF((x) => (x.wilaya ? x : { ...x, wilaya: wilayaValue(w) })));
  }, [loc]);

  const setCart = (fn: (c: Cart) => Cart) => setCartState((c) => { const n = fn(c); writeCart(shop.slug, n); return n; });
  const qty = (id: string, d: number) => setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(99, (c[id] ?? 0) + d)) }));

  const lines = shop.products.filter((p) => cart[p.id] > 0);
  const subtotal = lines.reduce((s, p) => s + p.price_dzd * cart[p.id], 0);
  const q = f.wilaya ? quote(shop, f.wilaya) : null;
  const fee = q ? (q.off ? 0 : f.type === "desk" ? q.desk : q.home) : 0;
  const payLines = lines.map((p) => ({ price_dzd: p.price_dzd, qty: cart[p.id], pay_cod: p.pay_cod, pay_card: p.pay_card, deposit_pct: p.deposit_pct }));
  const allowed = allowedMethods(payLines);
  const method: PayMethod = payPick === "card" ? (allowed.card ? "card" : "cod") : (allowed.cod ? "cod" : "card");
  const split = splitPayment(payLines, q && !q.off ? fee : 0, method);
  const payBlocked = split.online > 0 && !paymentsOn;
  const wilayas = useMemo(() => WILAYAS.map((w) => ({ v: wilayaValue(w), l: wilayaLabel(wilayaValue(w), lang) })), [lang]);
  const next = encodeURIComponent(`${path}#order`);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!lines.length) { setErr(t("cart_empty")); return; }
    if (!normalizePhone(f.phone)) { setErr(t("err_phone")); return; }
    if (q?.off) { setErr(t("err_no_delivery")); return; }
    if (payBlocked) { setErr(t("pay_online_unavailable")); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: shop.slug, customer_name: f.name, phone: f.phone, wilaya: f.wilaya, commune: f.commune,
          address: f.address, delivery_type: f.type, note: f.note, payment_method: method, card_type: cardType, lang,
          items: lines.map((p) => ({ product_id: p.id, quantity: cart[p.id] })),
        }),
      });
      const body = await res.json();
      if (!res.ok) { setErr(t((body.error as DictKey) || "error")); return; }
      writeCart(shop.slug, {});
      // remember delivery details for next time
      void supabase().auth.updateUser({ data: { full_name: f.name, phone: f.phone, wilaya: f.wilaya, commune: f.commune } });
      if (body.checkout_url) { setRedirecting(true); window.location.assign(body.checkout_url); return; }
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
      <div className="min-h-dvh">
        <PublicHeader />
        <main className="mx-auto max-w-xl px-4 py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">✓</div>
          <h1 className="font-display text-3xl">{t("order_sent_title")}</h1>
          <p className="mt-3 text-muted">{t("order_sent_body")}</p>
          <p className="my-4 font-mono text-3xl font-bold" dir="ltr">{done.number}</p>
          {done.payment_error ? <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t("pay_retry_later")}</p> : <p className="text-lg">{t("to_collect")}: <b>{formatDZD(done.total_dzd)}</b></p>}
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
          <span className="inline-block rounded-3xl bg-sand p-1.5 shadow-lg">
            <ShopLogo name={shop.name} logo={shop.logo} logoUrl={shop.logo_url} category={shop.category} size={80} />
          </span>
          <div className="mt-3">
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-display text-3xl leading-tight md:text-4xl">{shop.name}</h1>
              <FavoriteButton kind="shop" id={shop.id} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {shop.verified ? <VerifiedBadge /> : null}
              <RatingSummary rating={shop.rating} count={shop.review_count} />
            </div>
            <p className="text-sm text-muted">
              {shop.wilaya ? wilayaLabel(shop.wilaya, lang).replace(/^\d+ - /, "") : null}
              {shop.delivered_count > 0 ? <span className="text-ok"> · ✓ {t("delivered_count", { n: shop.delivered_count })}</span> : null}
            </p>
          </div>
        </div>
        {shop.description ? <p className="mt-4 max-w-2xl text-ink/90">{shop.description}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-brand inline-flex items-center gap-1"><Icon name="home" className="h-3.5 w-3.5" />{t("handmade")}</span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-ok inline-flex items-center gap-1"><Icon name="cash" className="h-3.5 w-3.5" />{t("cod")}</span>
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-muted inline-flex items-center gap-1"><Icon name="truck" className="h-3.5 w-3.5" />{t("delivery_from", { price: formatDZD(minFee(shop)) })}</span>
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
                <div className="flex justify-between text-muted"><span>{t("delivery_fee")} ({t(f.type)})</span><span>{q ? (q.off ? "—" : formatDZD(fee)) : t("delivery_from", { price: formatDZD(minFee(shop)) })}</span></div>
                {q?.days_min != null && q.days_max != null && !q.off ? <p className="text-xs text-muted">{t("delivery_days", { min: q.days_min, max: q.days_max })}</p> : null}
                {lines.length && split.online > 0 ? (
                  <div className="space-y-1 rounded-xl bg-gold-soft/50 p-2.5">
                    <div className="flex justify-between font-semibold"><span>{t("pay_now_amount")}</span><span className="whitespace-nowrap">{formatDZD(split.online)}</span></div>
                    <div className="flex justify-between text-muted"><span>{t("pay_on_delivery_amount")}</span><span className="whitespace-nowrap">{formatDZD(split.cod)}</span></div>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><span>{t("total")}</span><span className="text-brand">{formatDZD(subtotal + fee)}</span></div>
                <p className="flex items-center gap-1 pt-1 text-xs font-semibold text-ok"><Icon name="shield" className="h-4 w-4" />{t("pay_secure_note")}</p>
              </Card>

              {user === undefined ? (
                <div className="py-6 text-center"><Spinner /></div>
              ) : !user ? (
                <Card className="space-y-3 border-brand/30 bg-brand-soft/40 text-center">
                  <p className="text-lg font-semibold">{t("login_to_order")}</p>
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
                  {q?.off ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t("err_no_delivery")}</p> : !q ? <p className="text-xs text-muted">{t("delivery_choose_wilaya")}</p> : null}
                  <fieldset>
                    <legend className="mb-1 text-sm font-semibold">{t("delivery")}</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {(["home", "desk"] as const).map((k) => (
                        <label key={k} className={`cursor-pointer rounded-xl border p-3 text-sm ${f.type === k ? "border-brand bg-brand-soft" : "border-line bg-surface"}`}>
                          <input type="radio" name="type" className="sr-only" checked={f.type === k} onChange={() => setF({ ...f, type: k })} />
                          <span className="block font-semibold">{t(k)}</span>
                          <span className="text-muted">{q && !q.off ? formatDZD(k === "desk" ? q.desk : q.home) : "—"}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="mb-1 text-sm font-semibold">{t("pay_method")}</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {(["cod", "card"] as const).filter((k) => allowed[k]).map((k) => (
                        <label key={k} className={`cursor-pointer rounded-xl border p-3 text-sm ${method === k ? "border-brand bg-brand-soft" : "border-line bg-surface"}`}>
                          <input type="radio" name="pay" className="sr-only" checked={method === k} onChange={() => setPayPick(k)} />
                          <span className="flex items-center gap-1.5 font-semibold"><Icon name={k === "cod" ? "cash" : "shield"} className="h-4 w-4 shrink-0" />{t(k === "cod" ? "pay_cod" : "pay_card")}</span>
                          <span className="text-xs text-muted">{t(k === "cod" ? "pay_cod_sub" : "pay_card_sub")}</span>
                        </label>
                      ))}
                    </div>
                    {method === "cod" && split.deposit ? <p className="mt-2 text-xs text-muted">{t("pay_deposit_note")}</p> : null}
                    {split.online > 0 && paymentsOn ? (
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <span className="text-muted">{t("pay_card_type")}</span>
                        {(["edahabia", "cib"] as const).map((c) => (
                          <button key={c} type="button" onClick={() => setCardType(c)} className={`rounded-full border px-3 py-1 font-semibold ${cardType === c ? "border-brand bg-brand text-white" : "border-line bg-surface"}`}>{c === "cib" ? "CIB" : "Edahabia"}</button>
                        ))}
                      </div>
                    ) : null}
                    {payBlocked ? <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t("pay_online_unavailable")}</p> : split.online > 0 ? <p className="mt-2 text-xs text-muted">{t("pay_expiry_note")}</p> : null}
                  </fieldset>
                  {f.type === "home" ? <Field label={t("address")}><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field> : null}
                  <Field label={`${t("note")} (${t("optional")})`}><Textarea rows={2} maxLength={500} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
                  {err ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-danger" role="alert">{err}</p> : null}
                  <Link href="/confiance" className="block text-center text-xs text-muted underline">{t("order_consent")}</Link>
                  <Button type="submit" className="w-full text-lg" disabled={busy || redirecting || Boolean(q?.off) || payBlocked}>
                    {redirecting ? t("pay_redirecting") : busy ? t("sending") : split.online > 0 ? t("pay_and_order", { amount: formatDZD(split.online) }) : `${t("place_order")} · ${formatDZD(subtotal + fee)}`}
                  </Button>
                </form>
              )}
            </div>
          </aside>
        </div>

        <div className="mt-12 max-w-2xl"><ReviewList reviews={shop.reviews ?? []} rating={shop.rating} count={shop.review_count} showProduct /></div>

        <footer className="mt-12 border-t border-line py-6 text-center text-sm text-muted">
          <Link href="/" aria-label="Bledify" className="inline-block align-middle"><Logo height={22} /></Link> · <Link href="/track" className="underline">{t("track_order")}</Link> · <Link href="/confiance" className="underline">{t("trust_title")}</Link> · <ReportButton kind="shop" targetId={shop.id} />
        </footer>
      </div>

      {/* sticky cart bar on phones */}
      {lines.length ? (
        <a href="#order" className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-between rounded-2xl bg-ink px-4 py-3.5 font-semibold text-white shadow-xl md:hidden">
          <span className="inline-flex items-center gap-2"><Icon name="bag" className="h-5 w-5" />{lines.reduce((n, p) => n + cart[p.id], 0)} · {formatDZD(subtotal)}</span>
          <span>{t("order_now")} →</span>
        </a>
      ) : null}
    </div>
  );
}
