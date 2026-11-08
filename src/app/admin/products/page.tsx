"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { CATEGORIES, catKey, subKey } from "@/lib/categories";
import { Button, Select, Spinner } from "@/components/ui";
import { Chips, DataTable, Pill, SearchInput, adminCall, useAdminRpc, type Col } from "@/components/admin/AdminUI";

type Row = {
  id: string; name: string; price_dzd: number; image: string; category: string; subcategory: string | null;
  active: boolean; seller_active: boolean; blocked: boolean; block_reason: string; created_at: string;
  shop: { id: string; name: string; slug: string; suspended: boolean };
};
type F = "" | "visible" | "hidden" | "blocked";

/** All products: search, filter, sort, export; hide or restore one or many at once. */
export default function AdminProducts() {
  const { t, lang, formatDZD } = useI18n();
  const [q, setQ] = useState<string | null>(null);
  const [cat, setCat] = useState("");
  const [f, setF] = useState<F>("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  useEffect(() => { queueMicrotask(() => setQ(new URLSearchParams(window.location.search).get("q") ?? "")); }, []);
  const { data, reload } = useAdminRpc<Row[]>("admin_products", { p_q: q ?? "", p_category: cat, p_filter: f });
  const onSearch = useCallback((v: string) => setQ(v), []);

  async function bulk(block: boolean) {
    const ids = [...sel];
    const ok = block ? await adminCall("admin_block_products", { p_products: ids, p_reason: reason })
      : (await Promise.all(ids.map((id) => adminCall("admin_set_product_blocked", { p_product: id, p_blocked: false })))).every(Boolean);
    if (ok) { setSel(new Set()); setReason(""); await reload(); }
  }
  const state = (p: Row) => p.blocked ? <Pill tone="danger">{t("adm_blocked_badge")}</Pill> : !p.seller_active ? <Pill>{t("adm_hidden_badge")}</Pill>
    : p.shop.suspended ? <Pill tone="danger">{t("adm_suspended_badge")}</Pill> : p.active ? <Pill tone="ok">{t("adm_f_visible")}</Pill> : <Pill tone="warn">{t("adm_status_pending")}</Pill>;
  const cols: Col<Row>[] = [
    { key: "name", label: t("product_name"), sort: (p) => p.name.toLowerCase(), csv: (p) => p.name, render: (p) => (
      <span className="flex items-center gap-2"><span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-sand">{p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : null}</span>
        <span className="min-w-0"><Link href={`/p/${p.id}`} target="_blank" className="font-semibold hover:text-brand">{p.name}</Link>
          {p.blocked && p.block_reason ? <span className="block text-xs text-danger" dir="auto">{p.block_reason}</span> : null}</span></span>) },
    { key: "shop", label: t("shop"), sort: (p) => p.shop.name, csv: (p) => p.shop.name, render: (p) => <Link href={`/admin/shops/${p.shop.id}`} className="hover:text-brand">{p.shop.name}</Link> },
    { key: "cat", label: t("category"), sort: (p) => p.category, csv: (p) => `${p.category}/${p.subcategory ?? ""}`, render: (p) => <span className="text-xs">{t(catKey(p.category))}{p.subcategory ? <span className="block text-muted">{t(subKey(p.subcategory))}</span> : null}</span> },
    { key: "price", label: t("price"), sort: (p) => p.price_dzd, csv: (p) => p.price_dzd, render: (p) => <span className="whitespace-nowrap">{formatDZD(p.price_dzd)}</span>, className: "text-end" },
    { key: "state", label: t("status"), sort: (p) => (p.blocked ? 0 : p.active ? 2 : 1), csv: (p) => p.blocked ? "blocked" : p.active ? "visible" : "hidden", render: state },
    { key: "created", label: t("adm_created"), sort: (p) => p.created_at, csv: (p) => p.created_at.slice(0, 10), render: (p) => <span className="whitespace-nowrap">{formatDate(p.created_at, lang)}</span> },
  ];
  if (q === null) return <div className="py-16 text-center"><Spinner /></div>;
  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl">{t("adm_nav_products")}</h1>
      <SearchInput initial={q} onSearch={onSearch} />
      <Select value={cat} onChange={(e) => setCat(e.target.value)}>
        <option value="">{t("all_categories")}</option>
        {CATEGORIES.map((c) => <option key={c} value={c}>{t(catKey(c))}</option>)}
      </Select>
      <Chips value={f} onChange={setF} options={[{ key: "", label: t("all") }, { key: "visible", label: t("adm_f_visible") }, { key: "hidden", label: t("adm_f_hidden") }, { key: "blocked", label: t("adm_f_blocked") }]} />
      {sel.size ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-brand/30 bg-brand-soft/40 p-2 text-sm">
          <b>{t("adm_selected", { n: sel.size })}</b>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("adm_block_reason")} dir="auto" className="min-w-0 flex-1 rounded-lg border border-line px-2 py-1.5" />
          <Button size="sm" variant="danger" onClick={() => bulk(true)}>{t("adm_block")}</Button>
          <Button size="sm" variant="secondary" onClick={() => bulk(false)}>{t("adm_unblock")}</Button>
        </div>
      ) : null}
      {!data ? <div className="py-16 text-center"><Spinner /></div> : <DataTable rows={data} cols={cols} rowKey={(p) => p.id} filename="produits" selectable selected={sel} onSelect={setSel} />}
    </div>
  );
}
