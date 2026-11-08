"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { offerTitle, type Offer } from "@/lib/offers";
import { Icon } from "@/components/Icon";

type Entry = { id: number; offer_slug: string; status: "pending" | "approved" | "rejected"; note: string };

/** A shop proposes a product for Bledify offers; the team approves before it appears on the offer page. */
export function OfferRequests({ productId, shopId }: { productId?: string; shopId?: string }) {
  const { t, lang } = useI18n();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void supabase().from("offers").select("*").eq("active", true).order("position").then(({ data }) => setOffers((data ?? []) as Offer[]));
  }, []);
  useEffect(() => {
    if (!productId) return;
    void supabase().from("offer_entries").select("id, offer_slug, status, note").eq("product_id", productId)
      .then(({ data }) => setEntries((data ?? []) as Entry[]));
  }, [productId]);

  async function propose(slug: string) {
    if (!productId || !shopId) return;
    setBusy(slug);
    const { data } = await supabase().from("offer_entries").insert({ offer_slug: slug, product_id: productId, shop_id: shopId })
      .select("id, offer_slug, status, note").single();
    if (data) setEntries((e) => [...e, data as Entry]);
    setBusy(null);
  }
  async function withdraw(entry: Entry) {
    setBusy(entry.offer_slug);
    const { error } = await supabase().from("offer_entries").delete().eq("id", entry.id);
    if (!error) setEntries((e) => e.filter((x) => x.id !== entry.id));
    setBusy(null);
  }

  return (
    <fieldset className="space-y-2 rounded-xl border border-line p-3">
      <legend className="px-1 text-sm font-semibold">{t("offers_label")}</legend>
      <p className="text-xs text-muted">{t("offers_hint")}</p>
      {!productId ? <p className="text-xs font-semibold text-amber-800">{t("offers_save_first")}</p> : (
        <ul className="divide-y divide-line">
          {offers.map((o) => {
            const e = entries.find((x) => x.offer_slug === o.slug);
            return (
              <li key={o.slug} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2"><Icon name={o.icon} className="h-4 w-4 shrink-0 text-gold" /><span className="truncate">{offerTitle(o, lang)}</span></span>
                {!e ? (
                  <button type="button" disabled={busy === o.slug} onClick={() => propose(o.slug)} className="shrink-0 rounded-full border border-brand px-3 py-1 text-xs font-semibold text-brand">{t("offer_request")}</button>
                ) : (
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${e.status === "approved" ? "bg-emerald-50 text-ok" : e.status === "rejected" ? "bg-rose-50 text-danger" : "bg-amber-50 text-amber-900"}`}>
                      {t(`offer_${e.status}`)}
                    </span>
                    <button type="button" disabled={busy === o.slug} onClick={() => withdraw(e)} className="text-xs text-muted underline">{t("offer_withdraw")}</button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
