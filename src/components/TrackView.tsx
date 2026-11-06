"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useI18n, LangSwitch } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import { wilayaLabel } from "@/lib/wilayas";
import type { HistoryEntry, OrderItem } from "@/lib/orders";
import { Button, Card, Field, Input, StatusPill } from "@/components/ui";
import type { DictKey } from "@/lib/i18n/dict";

type Tracked = {
  number: string; status: string; history: HistoryEntry[]; carrier: string; tracking_number: string;
  items: OrderItem[]; total_dzd: number; wilaya: string; commune: string; delivery_type: "home" | "desk";
  created_at: string; shop_name: string; shop_slug: string;
};

export function TrackView() {
  const { t, lang, formatDZD } = useI18n();
  const [num, setNum] = useState(useSearchParams().get("n") ?? "");
  const [phone, setPhone] = useState("");
  const [res, setRes] = useState<Tracked | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data } = await supabase().rpc("track_order", { p_number: num, p_phone: phone });
    setRes((data as Tracked) ?? null);
    setBusy(false);
  }

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/" className="font-display text-2xl text-brand">Bledify</Link>
        <LangSwitch />
      </header>
      <h1 className="mb-4 font-display text-3xl">{t("track_title")}</h1>
      <form onSubmit={go} className="space-y-3">
        <Field label={t("order_number")}><Input required dir="ltr" placeholder="BL-123456" value={num} onChange={(e) => setNum(e.target.value)} /></Field>
        <Field label={t("phone")}><Input required type="tel" dir="ltr" placeholder="0661 23 45 67" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Button type="submit" className="w-full" disabled={busy}>{t("track_btn")}</Button>
      </form>
      {res === null ? <p className="mt-6 rounded-xl bg-rose-50 p-3 text-sm text-danger" role="alert">{t("track_not_found")}</p> : null}
      {res ? (
        <Card className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono font-bold" dir="ltr">{res.number}</span>
            <StatusPill status={res.status} />
          </div>
          <p className="text-sm">{t("shop")}: <Link className="font-semibold text-brand" href={`/s/${res.shop_slug}`}>{res.shop_name}</Link></p>
          <p className="text-sm">{res.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}</p>
          <p className="text-sm">{t(res.delivery_type)} — {wilayaLabel(res.wilaya, lang)}{res.commune ? `, ${res.commune}` : ""}</p>
          <p className="font-bold">{t("to_collect")}: {formatDZD(res.total_dzd)}</p>
          {res.tracking_number || res.carrier ? (
            <p className="rounded-lg bg-amber-50 p-2 text-sm font-semibold text-amber-800" dir="ltr">{[res.carrier, res.tracking_number].filter(Boolean).join(" · ")}</p>
          ) : null}
          <ol className="space-y-1 border-s-2 border-line ps-4 text-sm">
            {[...res.history].filter((h) => h.status !== "no_answer").reverse().map((h, k) => (
              <li key={k}><b>{t(`st_${h.status}` as DictKey)}</b> <span className="text-muted">{formatDateTime(h.at, lang)}</span></li>
            ))}
          </ol>
        </Card>
      ) : null}
    </main>
  );
}
