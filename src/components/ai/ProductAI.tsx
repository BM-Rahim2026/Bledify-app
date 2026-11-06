"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { aiPost } from "@/lib/ai-client";
import { Button, Input, Spinner } from "@/components/ui";
import type { DictKey } from "@/lib/i18n/dict";

export type Listing = {
  name: string; description: string; category: string;
  price_min_dzd: number; price_max_dzd: number; price_note: string; tips: string[];
};

/** "Remplir avec l'IA": drafts title, description, category and a price range from photos + notes. */
export function ProductAI({ name, images, onResult, onPrice }: {
  name: string; images: string[];
  onResult: (l: Listing) => void; onPrice: (price: number) => void;
}) {
  const { t, lang, formatDZD } = useI18n();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<DictKey | null>(null);
  const [last, setLast] = useState<Listing | null>(null);

  async function run() {
    setBusy(true); setErr(null);
    const { data, error } = await aiPost<Listing>("/api/ai/product", { name, notes, images, lang });
    setBusy(false);
    if (error || !data) { setErr(error ?? "error"); return; }
    setLast(data);
    onResult(data);
  }

  const mid = last ? Math.round(((last.price_min_dzd + last.price_max_dzd) / 2) / 50) * 50 : 0;
  return (
    <div className="space-y-2 rounded-2xl border border-brand/30 bg-brand-soft/50 p-3">
      <p className="text-xs text-muted">{t("ai_fill_hint")}</p>
      <Input placeholder={t("ai_notes_ph")} aria-label={t("ai_notes")} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <Button type="button" className="w-full" onClick={run} disabled={busy}>
        {busy ? <><Spinner /> {t("ai_working")}</> : <>✨ {t("ai_fill")}</>}
      </Button>
      {err ? <p className="text-sm text-danger" role="alert">{t(err)}</p> : null}
      {last ? (
        <div className="space-y-2 rounded-xl bg-surface p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p><span className="text-muted">{t("ai_price_suggestion")} : </span>
              <b className="whitespace-nowrap">{formatDZD(last.price_min_dzd)} – {formatDZD(last.price_max_dzd)}</b></p>
            <Button type="button" size="sm" variant="secondary" onClick={() => onPrice(mid)}>{t("ai_apply_price")} {formatDZD(mid)}</Button>
          </div>
          <p className="text-muted">{last.price_note}</p>
          {last.tips.length ? (
            <div>
              <p className="font-semibold">{t("ai_tips")}</p>
              <ul className="list-disc space-y-0.5 ps-5 text-muted">{last.tips.slice(0, 3).map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          ) : null}
          <p className="text-xs text-muted">{t("ai_disclaimer")}</p>
        </div>
      ) : null}
    </div>
  );
}
