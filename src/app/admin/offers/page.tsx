"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { wilayaLabel } from "@/lib/wilayas";
import { catKey, subKey } from "@/lib/categories";
import { offerTitle } from "@/lib/offers";
import { Spinner } from "@/components/ui";
import { VerifiedBadge } from "@/components/trust/Trust";
import type { DictKey } from "@/lib/i18n/dict";

type Entry = {
  id: number; status: "pending" | "approved" | "rejected"; note: string; created_at: string; reviewed_at: string | null;
  offer: { slug: string; title_fr: string; title_ar: string; kind: string; active: boolean };
  product: { id: string; name: string; price_dzd: number; image: string; category: string; subcategory: string | null; active: boolean };
  shop: { id: string; name: string; slug: string; wilaya: string; verified: boolean };
};
const FILTERS = ["pending", "approved", "rejected", ""] as const;

/** Team review of the products shops propose for offers. */
export default function AdminProposals() {
  const { t, lang, formatDZD } = useI18n();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("pending");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async (f: string) => {
    const { data } = await supabase().rpc("admin_offer_entries", { p_status: f, p_limit: 200 });
    setEntries((data ?? []) as Entry[]);
  }, []);
  useEffect(() => { queueMicrotask(() => void load(filter)); }, [filter, load]);

  async function decide(e: Entry, approve: boolean) {
    setBusy(e.id);
    const { error } = await supabase().rpc("admin_review_offer_entry", { p_entry: e.id, p_approve: approve, p_note: notes[e.id] ?? "" });
    setBusy(null);
    if (!error) setEntries((list) => (list ?? []).flatMap((x) => (x.id !== e.id ? [x] : filter === "pending" ? [] : [{ ...x, status: approve ? "approved" : "rejected", note: notes[e.id] ?? "" }])));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f || "all"} type="button" onClick={() => { setEntries(null); setFilter(f); }}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${filter === f ? "bg-ink text-white" : "border border-line bg-surface"}`}>
            {f ? t(`offer_${f}` as DictKey) : t("all")}
          </button>
        ))}
      </div>
      {entries === null ? <div className="py-16 text-center"><Spinner /></div> : entries.length === 0 ? (
        <p className="py-16 text-center text-muted">{t("admin_empty")}</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((e) => (
            <li key={e.id} className="rounded-2xl border border-line bg-surface p-3 shadow-sm">
              <div className="flex gap-3">
                <Link href={`/p/${e.product.id}`} target="_blank" className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-sand">
                  {e.product.image ? <img src={e.product.image} alt="" className="h-full w-full object-cover" /> : null}
                </Link>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="inline-flex rounded-full bg-gold-soft px-2 py-0.5 text-xs font-semibold">{offerTitle(e.offer, lang)}{e.offer.active ? "" : ` · ${t("admin_offer_closed")}`}</p>
                  <p className="font-semibold leading-snug">{e.product.name}</p>
                  <p className="text-sm font-bold text-brand">{formatDZD(e.product.price_dzd)}</p>
                  <p className="text-xs text-muted">
                    {t(catKey(e.product.category))}{e.product.subcategory ? ` › ${t(subKey(e.product.subcategory))}` : ""}
                    {e.product.active ? "" : ` · ${t("admin_product_hidden")}`}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-muted">
                    <Link href={`/s/${e.shop.slug}`} target="_blank" className="font-semibold text-ink">{e.shop.name}</Link>
                    {e.shop.verified ? <VerifiedBadge compact /> : null}
                    <span>· {wilayaLabel(e.shop.wilaya, lang).replace(/^\d+ - /, "")} · {formatDate(e.created_at, lang)}</span>
                  </p>
                </div>
              </div>
              {e.status === "pending" ? (
                <div className="mt-3 space-y-2">
                  <input value={notes[e.id] ?? ""} onChange={(x) => setNotes({ ...notes, [e.id]: x.target.value })} maxLength={300}
                    placeholder={t("admin_note_ph")} className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm" dir="auto" />
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" disabled={busy === e.id} onClick={() => decide(e, true)} className="rounded-xl bg-brand px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{t("admin_approve")}</button>
                    <button type="button" disabled={busy === e.id} onClick={() => decide(e, false)} className="rounded-xl border border-danger/40 bg-rose-50 px-3 py-2.5 text-sm font-semibold text-danger disabled:opacity-60">{t("admin_reject")}</button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${e.status === "approved" ? "bg-emerald-50 text-ok" : "bg-rose-50 text-danger"}`}>{t(`offer_${e.status}` as DictKey)}</span>
                  {e.note ? <span className="text-xs text-muted" dir="auto">{e.note}</span> : null}
                  <span className="flex gap-3">
                    <button type="button" disabled={busy === e.id} onClick={() => decide(e, e.status !== "approved")} className="text-xs font-semibold text-brand underline">
                      {e.status === "approved" ? t("admin_reject") : t("admin_approve")}
                    </button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
