"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { CATEGORIES, catKey, subKey } from "@/lib/categories";
import { Select, Spinner } from "@/components/ui";
import { Chips, Empty, Pill, SearchInput, adminCall, useAdminRpc } from "@/components/admin/AdminUI";

type Row = {
  id: string; name: string; price_dzd: number; image: string; category: string; subcategory: string | null;
  active: boolean; seller_active: boolean; blocked: boolean; block_reason: string; created_at: string;
  shop: { id: string; name: string; slug: string; suspended: boolean };
};
type F = "" | "visible" | "hidden" | "blocked";

/** All products: search, filter, hide from the marketplace (the shop cannot undo it). */
export default function AdminProducts() {
  const { t, formatDZD } = useI18n();
  const [q, setQ] = useState<string | null>(null);
  const [cat, setCat] = useState("");
  const [f, setF] = useState<F>("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { queueMicrotask(() => setQ(new URLSearchParams(window.location.search).get("q") ?? "")); }, []);
  const { data, reload } = useAdminRpc<Row[]>("admin_products", { p_q: q ?? "", p_category: cat, p_filter: f });
  const onSearch = useCallback((v: string) => setQ(v), []);

  async function setBlocked(p: Row, blocked: boolean) {
    if (await adminCall("admin_set_product_blocked", { p_product: p.id, p_blocked: blocked, p_reason: reasons[p.id] ?? "" })) {
      setOpen(null); await reload();
    }
  }

  if (q === null) return <div className="py-16 text-center"><Spinner /></div>;
  return (
    <div className="space-y-3">
      <SearchInput initial={q} onSearch={onSearch} />
      <Select value={cat} onChange={(e) => setCat(e.target.value)}>
        <option value="">{t("all_categories")}</option>
        {CATEGORIES.map((c) => <option key={c} value={c}>{t(catKey(c))}</option>)}
      </Select>
      <Chips value={f} onChange={setF} options={[
        { key: "", label: t("all") }, { key: "visible", label: t("adm_f_visible") },
        { key: "hidden", label: t("adm_f_hidden") }, { key: "blocked", label: t("adm_f_blocked") }]} />
      {!data ? <div className="py-16 text-center"><Spinner /></div> : data.length === 0 ? <Empty /> : (
        <ul className="space-y-2">
          {data.map((p) => (
            <li key={p.id} className="rounded-2xl border border-line bg-surface p-3 shadow-sm">
              <div className="flex gap-3">
                <Link href={`/p/${p.id}`} target="_blank" className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-sand">
                  {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : null}
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug">{p.name}</p>
                  <p className="text-sm font-bold text-brand">{formatDZD(p.price_dzd)}</p>
                  <p className="truncate text-xs text-muted">{t(catKey(p.category))}{p.subcategory ? ` › ${t(subKey(p.subcategory))}` : ""}</p>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs">
                    <Link href={`/admin/shops/${p.shop.id}`} className="font-semibold text-ink">{p.shop.name}</Link>
                    {p.blocked ? <Pill tone="danger">{t("adm_blocked_badge")}</Pill> : !p.seller_active ? <Pill>{t("adm_hidden_badge")}</Pill> : p.active ? <Pill tone="ok">{t("adm_f_visible")}</Pill> : null}
                    {p.shop.suspended ? <Pill tone="danger">{t("adm_suspended_badge")}</Pill> : null}
                  </p>
                  {p.blocked && p.block_reason ? <p className="text-xs text-danger" dir="auto">{p.block_reason}</p> : null}
                </div>
              </div>
              {p.blocked ? (
                <button type="button" onClick={() => setBlocked(p, false)} className="mt-2 text-sm font-semibold text-brand underline">{t("adm_unblock")}</button>
              ) : open === p.id ? (
                <div className="mt-2 flex gap-2">
                  <input value={reasons[p.id] ?? ""} onChange={(e) => setReasons({ ...reasons, [p.id]: e.target.value })} maxLength={300}
                    placeholder={t("adm_block_reason")} dir="auto" className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm" />
                  <button type="button" onClick={() => setBlocked(p, true)} className="shrink-0 rounded-xl bg-danger px-3 py-2 text-sm font-semibold text-white">{t("adm_block")}</button>
                </div>
              ) : (
                <button type="button" onClick={() => setOpen(p.id)} className="mt-2 text-sm font-semibold text-danger underline">{t("adm_block")}</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
