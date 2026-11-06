"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useSeller } from "@/lib/seller";
import { Button, Card, Empty, Field, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { CATEGORIES, catKey } from "@/lib/categories";
import { ProductAI } from "@/components/ai/ProductAI";
import { PostGenerator } from "@/components/ai/PostGenerator";
import { PageHeader } from "@/components/PageHeader";

type Product = { id: string; name: string; description: string; price_dzd: number; images: string[]; active: boolean; position: number; category: string };
const fetchProducts = async () =>
  ((await supabase().from("products").select("*").order("position").order("created_at")).data ?? []) as Product[];
const blank = { name: "", description: "", price_dzd: 0, images: [] as string[], active: true, category: "gateaux" };

function ProductsInner() {
  const { t, formatDZD } = useI18n();
  const { shop, user } = useSeller();
  const params = useSearchParams();
  const [list, setList] = useState<Product[] | null>(null);
  const [edit, setEdit] = useState<(Partial<Product> & typeof blank) | null>(params.get("new") ? { ...blank } : null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [postFor, setPostFor] = useState<string | null>(null);

  const load = useCallback(() => fetchProducts().then(setList), []);
  useEffect(() => { fetchProducts().then(setList); }, []);

  async function upload(files: FileList | null) {
    if (!files?.length || !edit) return;
    setUploading(true); setErr(null);
    const urls: string[] = [];
    for (const f of Array.from(files).slice(0, 6)) {
      const ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase().storage.from("product-images").upload(path, f, { contentType: f.type, upsert: false });
      if (error) { setErr(t("error")); continue; }
      urls.push(supabase().storage.from("product-images").getPublicUrl(path).data.publicUrl);
    }
    setEdit((e) => e && { ...e, images: [...e.images, ...urls] });
    setUploading(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setBusy(true); setErr(null);
    const row = { name: edit.name, description: edit.description, price_dzd: edit.price_dzd, images: edit.images, active: edit.active, category: edit.category };
    const sb = supabase();
    const { error } = edit.id
      ? await sb.from("products").update(row).eq("id", edit.id)
      : await sb.from("products").insert({ ...row, shop_id: shop.id, position: list?.length ?? 0 });
    setBusy(false);
    if (error) { setErr(t("error")); return; }
    setEdit(null);
    void load();
  }

  async function remove(id: string) {
    if (!confirm(t("confirm_delete"))) return;
    await supabase().from("products").delete().eq("id", id);
    setEdit(null);
    void load();
  }

  return (
    <>
      <PageHeader title={t("products")} action={<Button size="sm" onClick={() => setEdit({ ...blank })}>+ {t("add_product")}</Button>} />
      <div className="space-y-3 p-4">
        {list === null ? <div className="py-10 text-center"><Spinner /></div>
          : list.length === 0 ? <Empty>{t("no_products")}</Empty>
          : list.map((p) => (
            <Card key={p.id} className="flex cursor-pointer items-center gap-3" onClick={() => setEdit({ ...p })}>
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-sand">
                {p.images[0] ? <img src={p.images[0]} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="font-bold text-brand">{formatDZD(p.price_dzd)}</p>
              </div>
              {!p.active ? <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-muted">{t("hidden")}</span> : null}
              <button type="button" aria-label={t("ai_post")} title={t("ai_post")} onClick={(e) => { e.stopPropagation(); setPostFor(p.id); }}
                className="shrink-0 rounded-xl border border-line px-2.5 py-2 text-sm hover:border-brand">📣</button>
            </Card>
          ))}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? t("edit_product") : t("add_product")}>
        {edit ? (
          <form onSubmit={save} className="max-h-[75dvh] space-y-3 overflow-y-auto">
            <ProductAI
              name={edit.name}
              images={edit.images}
              onResult={(l) => setEdit((e) => e && { ...e, name: l.name, description: l.description, category: l.category, price_dzd: e.price_dzd || Math.round(((l.price_min_dzd + l.price_max_dzd) / 2) / 50) * 50 })}
              onPrice={(price) => setEdit((e) => e && { ...e, price_dzd: price })}
            />
            <Field label={t("product_name")}><Input required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label={t("price")}><Input required type="number" min={0} inputMode="numeric" value={edit.price_dzd} onChange={(e) => setEdit({ ...edit, price_dzd: Number(e.target.value) })} /></Field>
            <Field label={t("category")}>
              <Select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{t(catKey(c))}</option>)}
              </Select>
            </Field>
            <Field label={t("shop_description")}><Textarea rows={2} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <div>
              <p className="mb-1 text-sm font-semibold">{t("photos")}</p>
              <div className="flex flex-wrap gap-2">
                {edit.images.map((src) => (
                  <div key={src} className="relative h-20 w-20 overflow-hidden rounded-xl bg-sand">
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <button type="button" aria-label={t("delete")} className="absolute end-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white"
                      onClick={() => setEdit({ ...edit, images: edit.images.filter((x) => x !== src) })}>✕</button>
                  </div>
                ))}
                <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-line text-center text-xs text-muted">
                  {uploading ? t("uploading") : `+ ${t("add_photo")}`}
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
                </label>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-brand" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
              {t("active")}
            </label>
            {err ? <p className="text-sm text-danger">{err}</p> : null}
            <div className="flex gap-2 pt-2">
              {edit.id ? <Button type="button" variant="danger" onClick={() => remove(edit.id!)}>{t("delete")}</Button> : null}
              {edit.id ? <Button type="button" variant="secondary" onClick={() => setPostFor(edit.id!)}>📣<span className="sr-only">{t("ai_post")}</span></Button> : null}
              <Button type="submit" className="flex-1" disabled={busy || uploading}>{t("save")}</Button>
            </div>
          </form>
        ) : null}
      </Modal>
      {postFor ? <PostGenerator productId={postFor} open onClose={() => setPostFor(null)} /> : null}
    </>
  );
}

export default function ProductsPage() {
  return <Suspense><ProductsInner /></Suspense>;
}
