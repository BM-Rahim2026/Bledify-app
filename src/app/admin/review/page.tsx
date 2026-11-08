"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { catKey, subKey } from "@/lib/categories";
import { Button, Spinner } from "@/components/ui";
import { Empty, adminCall, useAdminRpc } from "@/components/admin/AdminUI";

type Item = { id: string; name: string; description: string; story: string; price_dzd: number; images: string[]; category: string; subcategory: string | null;
  created_at: string; shop: { id: string; name: string; slug: string } };

/** Pre-moderation for shops not yet verified: new or edited listings are checked before they stay online. */
export default function ReviewQueue() {
  const { t, lang, formatDZD } = useI18n();
  const { data, reload } = useAdminRpc<Item[]>("admin_review_queue", {});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<Set<string>>(new Set());
  async function ok(ids: string[]) { if (await adminCall("admin_mark_reviewed", { p_products: ids })) { setSel(new Set()); await reload(); } }
  async function block(id: string) { if (await adminCall("admin_block_products", { p_products: [id], p_reason: reasons[id] ?? "" })) await reload(); }
  if (!data) return <div className="py-16 text-center"><Spinner /></div>;
  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl">{t("adm_nav_review")}</h1>
      <p className="text-sm text-muted">{t("adm_review_hint")}</p>
      {data.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setSel(new Set(sel.size === data.length ? [] : data.map((x) => x.id)))}>{t("adm_select_all")}</Button>
          {sel.size ? <Button size="sm" onClick={() => ok([...sel])}>{t("adm_approve_n", { n: sel.size })}</Button> : null}
        </div>
      ) : null}
      {data.length === 0 ? <Empty text={t("adm_review_empty")} /> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.map((p) => (
            <li key={p.id} className={`rounded-2xl border bg-surface p-3 shadow-sm ${sel.has(p.id) ? "border-brand" : "border-line"}`}>
              <label className="mb-2 flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" className="h-4 w-4 accent-brand" checked={sel.has(p.id)} onChange={() => { const n = new Set(sel); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); setSel(n); }} />
                <Link href={`/admin/shops/${p.shop.id}`} className="font-semibold text-ink">{p.shop.name}</Link> · {formatDate(p.created_at, lang)}
              </label>
              <div className="no-scrollbar flex gap-2 overflow-x-auto">
                {p.images.length ? p.images.map((src) => <img key={src} src={src} alt="" className="h-28 w-28 shrink-0 rounded-xl object-cover" />) : <span className="flex h-28 w-28 items-center justify-center rounded-xl bg-sand text-xs text-muted">{t("adm_no_photo")}</span>}
              </div>
              <p className="mt-2 font-semibold">{p.name} · <span className="text-brand">{formatDZD(p.price_dzd)}</span></p>
              <p className="text-xs text-muted">{t(catKey(p.category))}{p.subcategory ? ` › ${t(subKey(p.subcategory))}` : ""}</p>
              {p.description ? <p className="mt-1 line-clamp-3 text-sm" dir="auto">{p.description}</p> : null}
              {p.story ? <p className="mt-1 line-clamp-2 text-xs italic text-muted" dir="auto">{p.story}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => ok([p.id])}>{t("admin_approve")}</Button>
                <input value={reasons[p.id] ?? ""} onChange={(e) => setReasons({ ...reasons, [p.id]: e.target.value })} placeholder={t("adm_block_reason")} dir="auto" className="min-w-0 flex-1 rounded-lg border border-line px-2 py-1.5 text-sm" />
                <Button size="sm" variant="danger" onClick={() => block(p.id)}>{t("adm_block")}</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
