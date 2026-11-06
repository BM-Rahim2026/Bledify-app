"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import type { Shop } from "@/lib/seller";
import { LOGO_COLORS, LOGO_SHAPES, ShopLogo, defaultLogo, type LogoConfig } from "@/components/ShopLogo";
import { Button, Card, Spinner } from "@/components/ui";

/** Seller picks a generated logo (shape × initials/icon × colour) or uploads their own. */
export function LogoPicker({ shop, onSaved }: { shop: Shop; onSaved: () => Promise<void> | void }) {
  const { t } = useI18n();
  const [category, setCategory] = useState<string | null>(null);
  const [cfg, setCfg] = useState<Required<LogoConfig>>({ ...defaultLogo(shop.name), ...(shop.logo ?? {}) } as Required<LogoConfig>);
  const [url, setUrl] = useState(shop.logo_url ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase().rpc("shop_category", { p_shop: shop.id }).then(({ data }) => setCategory((data as string) ?? null));
  }, [shop.id]);

  async function save(next: { logo?: LogoConfig; logo_url?: string }) {
    setBusy(true);
    await supabase().from("shops").update(next).eq("id", shop.id);
    setBusy(false);
    await onSaved();
  }

  function choose(c: Partial<LogoConfig>) {
    const next = { ...cfg, ...c } as Required<LogoConfig>;
    setCfg(next); setUrl("");
    void save({ logo: next, logo_url: "" });
  }

  async function upload(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setBusy(true);
    const { data: u } = await supabase().auth.getUser();
    const ext = (f.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${u.user?.id}/logo-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase().storage.from("product-images").upload(path, f, { contentType: f.type });
    if (!error) {
      const publicUrl = supabase().storage.from("product-images").getPublicUrl(path).data.publicUrl;
      setUrl(publicUrl);
      await save({ logo_url: publicUrl });
    }
    setBusy(false);
  }

  const options: LogoConfig[] = LOGO_SHAPES.flatMap((shape) =>
    (category ? ["initials", "icon"] : ["initials"]).map((content) => ({ shape, content, color: cfg.color })));

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-4">
        <ShopLogo name={shop.name} logo={cfg} logoUrl={url} category={category} size={84} />
        <div className="min-w-0">
          <h2 className="font-semibold">{t("shop_logo")}</h2>
          <p className="text-sm text-muted">{t("logo_hint")}</p>
          {busy ? <Spinner /> : null}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {options.map((o) => {
          const active = !url && o.shape === cfg.shape && o.content === cfg.content;
          return (
            <button key={`${o.shape}-${o.content}`} type="button" onClick={() => choose(o)} aria-pressed={active}
              className={`flex items-center justify-center rounded-2xl border-2 p-1.5 ${active ? "border-brand bg-brand-soft" : "border-line bg-surface"}`}>
              <ShopLogo name={shop.name} logo={o} category={category} size={56} />
            </button>
          );
        })}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">{t("logo_color")}</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(LOGO_COLORS).map(([key, c]) => (
            <button key={key} type="button" onClick={() => choose({ color: key })} aria-label={key} aria-pressed={!url && cfg.color === key}
              className={`h-9 w-9 rounded-full ring-offset-2 ring-offset-surface ${!url && cfg.color === key ? "ring-2 ring-brand" : ""}`}
              style={{ background: c.bg }} />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="inline-flex min-h-9 cursor-pointer items-center rounded-xl border border-line bg-surface px-3 text-sm font-semibold">
          📷 {t("logo_upload")}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={busy} onChange={(e) => upload(e.target.files)} />
        </label>
        {url ? <Button size="sm" variant="ghost" onClick={() => { setUrl(""); void save({ logo_url: "" }); }}>{t("logo_remove")}</Button> : null}
      </div>
    </Card>
  );
}
