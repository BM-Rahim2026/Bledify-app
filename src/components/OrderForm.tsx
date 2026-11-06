"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useSeller } from "@/lib/seller";
import { normalizePhone } from "@/lib/format";
import { itemsTotal, type Order, type OrderItem } from "@/lib/orders";
import { WILAYAS, wilayaLabel, wilayaValue } from "@/lib/wilayas";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";

type Product = { id: string; name: string; price_dzd: number };
type Draft = Pick<Order, "customer_name" | "phone" | "wilaya" | "commune" | "address" | "delivery_type" | "items" | "delivery_dzd" | "note">;

/** Create or edit an order. Editing never touches status (status changes go through OrderActions). */
export function OrderForm({ order, onSaved }: { order?: Order; onSaved?: (o: Order) => void }) {
  const { t, lang, formatDZD } = useI18n();
  const { shop } = useSeller();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [d, setD] = useState<Draft>(() => ({
    customer_name: order?.customer_name ?? "", phone: order?.phone ?? "", wilaya: order?.wilaya ?? "",
    commune: order?.commune ?? "", address: order?.address ?? "", delivery_type: order?.delivery_type ?? "home",
    items: order?.items ?? [], delivery_dzd: order?.delivery_dzd ?? shop.delivery_home_dzd, note: order?.note ?? "",
  }));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    supabase().from("products").select("id,name,price_dzd").order("position").then(({ data }) => setProducts((data ?? []) as Product[]));
  }, []);

  // merge into current state so a concurrent status update on the page is never overwritten
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setItem = (i: number, patch: Partial<OrderItem>) => setD((x) => ({ ...x, items: x.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const phone = normalizePhone(d.phone);
    if (!phone) { setMsg({ ok: false, text: t("err_phone") }); return; }
    const items = d.items.filter((i) => i.name.trim() && i.quantity > 0);
    if (!items.length) { setMsg({ ok: false, text: t("cart_empty") }); return; }
    setBusy(true);
    const row = { ...d, phone, items };
    const sb = supabase();
    const res = order
      ? await sb.from("orders").update(row).eq("id", order.id).select("*").single()
      : await sb.from("orders").insert({ ...row, shop_id: shop.id, source: "manual", status: "new" }).select("*").single();
    setBusy(false);
    if (res.error) { setMsg({ ok: false, text: t("error") }); return; }
    setMsg({ ok: true, text: t("saved") });
    if (order) onSaved?.(res.data as Order);
    else router.replace(`/seller/orders/${res.data.id}`);
  }

  const subtotal = itemsTotal(d.items);
  return (
    <form onSubmit={save} className="space-y-4">
      <Field label={t("customer_name")}><Input required minLength={2} value={d.customer_name} onChange={(e) => set("customer_name", e.target.value)} /></Field>
      <Field label={t("phone")}><Input required type="tel" dir="ltr" inputMode="tel" placeholder="0661 23 45 67" value={d.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
      <Field label={t("wilaya")}>
        <Select required value={d.wilaya} onChange={(e) => set("wilaya", e.target.value)}>
          <option value="">{t("choose_wilaya")}</option>
          {WILAYAS.map((w) => <option key={w.code} value={wilayaValue(w)}>{wilayaLabel(wilayaValue(w), lang)}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("commune")}><Input value={d.commune} onChange={(e) => set("commune", e.target.value)} /></Field>
        <Field label={t("delivery")}>
          <Select value={d.delivery_type} onChange={(e) => {
            const v = e.target.value as "home" | "desk";
            setD((x) => ({ ...x, delivery_type: v, delivery_dzd: v === "desk" ? shop.delivery_desk_dzd : shop.delivery_home_dzd }));
          }}>
            <option value="home">{t("home")}</option>
            <option value="desk">{t("desk")}</option>
          </Select>
        </Field>
      </div>
      <Field label={t("address")}><Input value={d.address} onChange={(e) => set("address", e.target.value)} /></Field>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold">{t("items")}</legend>
        {d.items.map((it, i) => (
          <div key={i} className="grid grid-cols-[1fr_4rem_6rem_auto] items-end gap-2">
            <Input aria-label={t("product_name")} value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} />
            <Input aria-label={t("qty")} type="number" min={1} value={it.quantity} onChange={(e) => setItem(i, { quantity: Number(e.target.value) })} />
            <Input aria-label={t("unit_price")} type="number" min={0} value={it.unit_price_dzd} onChange={(e) => setItem(i, { unit_price_dzd: Number(e.target.value) })} />
            <button type="button" aria-label={t("delete")} className="p-2 text-danger" onClick={() => setD((x) => ({ ...x, items: x.items.filter((_, j) => j !== i) }))}>✕</button>
          </div>
        ))}
        <Select value="" aria-label={t("add_item")} onChange={(e) => {
          const p = products.find((x) => x.id === e.target.value);
          setD((x) => ({ ...x, items: [...x.items, p ? { product_id: p.id, name: p.name, unit_price_dzd: p.price_dzd, quantity: 1 } : { product_id: null, name: "", unit_price_dzd: 0, quantity: 1 }] }));
        }}>
          <option value="">+ {t("add_item")}</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatDZD(p.price_dzd)}</option>)}
          <option value="custom">…</option>
        </Select>
      </fieldset>

      <Field label={`${t("delivery_fee")} (DA)`}>
        <Input type="number" min={0} value={d.delivery_dzd} onChange={(e) => set("delivery_dzd", Number(e.target.value))} />
      </Field>
      <Field label={t("note")}><Textarea rows={2} value={d.note} onChange={(e) => set("note", e.target.value)} /></Field>
      <div className="flex justify-between rounded-xl bg-brand-soft px-4 py-3 font-bold">
        <span>{t("total")}</span><span>{formatDZD(subtotal + (d.delivery_dzd || 0))}</span>
      </div>
      {msg ? <p className={`text-sm ${msg.ok ? "text-ok" : "text-danger"}`} role="status">{msg.text}</p> : null}
      <Button type="submit" className="w-full" disabled={busy}>{order ? t("save") : t("create")}</Button>
    </form>
  );
}
