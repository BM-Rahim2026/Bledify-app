"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { readAllCarts, readCart, writeCart, type Cart } from "@/lib/cart";
import type { ProductCardData } from "@/lib/categories";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicNav } from "@/components/PublicNav";
import { ShopLogo, type LogoConfig } from "@/components/ShopLogo";
import { Icon } from "@/components/Icon";
import { minFee, type DeliveryZones } from "@/lib/delivery";
import { Card, Spinner } from "@/components/ui";

type Item = ProductCardData & { delivery_home_dzd: number; delivery_desk_dzd: number; delivery_zones?: DeliveryZones | null; shop_logo?: LogoConfig; shop_logo_url?: string };

/** Cart across all shops, grouped by shop: each shop's order is placed on its own page. */
export default function CartPage() {
  const { t, formatDZD } = useI18n();
  const [carts, setCarts] = useState<Record<string, Cart> | null>(null);
  const [items, setItems] = useState<Record<string, Item>>({});

  useEffect(() => {
    const all = readAllCarts();
    const ids = Object.values(all).flatMap((c) => Object.keys(c));
    queueMicrotask(() => setCarts(all));
    if (!ids.length) return;
    supabase().rpc("public_cart", { p_ids: ids }).then(({ data }) => {
      setItems(Object.fromEntries(((data ?? []) as Item[]).map((x) => [x.id, x])));
    });
  }, []);

  function setQty(slug: string, id: string, n: number) {
    const c = { ...readCart(slug), [id]: Math.max(0, Math.min(99, n)) };
    writeCart(slug, c);
    setCarts((all) => {
      const next = { ...(all ?? {}), [slug]: c };
      if (!Object.values(c).some((x) => x > 0)) delete next[slug];
      return next;
    });
  }

  const shops = Object.entries(carts ?? {}).filter(([, c]) => Object.values(c).some((n) => n > 0));

  return (
    <div className="min-h-dvh bg-ivory">
      <PublicHeader />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
        <h1 className="font-display text-3xl">{t("cart_title")}</h1>
        {carts === null ? <div className="py-16 text-center"><Spinner /></div> : shops.length === 0 ? (
          <div className="py-16 text-center">
            <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gold-soft text-brand"><Icon name="bag" className="h-8 w-8" /></span>
            <p className="text-muted">{t("cart_empty_title")}</p>
            <Link href="/explore" className="mt-4 inline-block rounded-full bg-brand px-5 py-3 font-semibold text-white">{t("start_shopping")}</Link>
          </div>
        ) : shops.map(([slug, cart]) => {
          const lines = Object.entries(cart).filter(([id, n]) => n > 0 && items[id]);
          const first = lines.length ? items[lines[0][0]] : null;
          const subtotal = lines.reduce((s, [id, n]) => s + items[id].price_dzd * n, 0);
          return (
            <Card key={slug} className="space-y-3">
              {first ? (
                <Link href={`/s/${slug}`} className="flex items-center gap-2">
                  <ShopLogo name={first.shop_name} logo={first.shop_logo} logoUrl={first.shop_logo_url} size={36} />
                  <span className="font-semibold">{first.shop_name}</span>
                </Link>
              ) : <Spinner />}
              {lines.map(([id, n]) => {
                const p = items[id];
                return (
                  <div key={id} className="flex gap-3">
                    <Link href={`/p/${id}`} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-sand">
                      {p.image ? <Image src={p.image} alt="" fill sizes="64px" className="object-cover" /> : null}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold">{p.name}</p>
                      <p className="text-sm font-bold text-brand">{formatDZD(p.price_dzd * n)}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex items-center rounded-full border border-line">
                          <button type="button" aria-label="-" className="p-1.5" onClick={() => setQty(slug, id, n - 1)}><Icon name="minus" className="h-4 w-4" /></button>
                          <span className="w-6 text-center text-sm font-bold">{n}</span>
                          <button type="button" aria-label="+" className="p-1.5" onClick={() => setQty(slug, id, n + 1)}><Icon name="plus" className="h-4 w-4" /></button>
                        </div>
                        <button type="button" className="text-xs font-semibold text-danger" onClick={() => setQty(slug, id, 0)}>{t("remove")}</button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-between border-t border-line pt-2 text-sm"><span className="text-muted">{t("cart_subtotal")}</span><b className="whitespace-nowrap">{formatDZD(subtotal)}</b></div>
              {first ? (
                <p className="text-xs text-muted">{t("delivery_from", { price: formatDZD(minFee(first)) })} · {t("cod")}</p>
              ) : null}
              <Link href={`/s/${slug}#order`} className="flex min-h-11 items-center justify-center rounded-full bg-brand px-4 text-center font-semibold text-white">
                {t("cart_order_from", { shop: first?.shop_name ?? "" })}
              </Link>
            </Card>
          );
        })}
      </main>
      <PublicNav />
    </div>
  );
}
