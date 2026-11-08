"use client";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { Stars } from "@/components/trust/Trust";
import { Spinner } from "@/components/ui";
import { Chips, Empty, Pill, adminCall, useAdminRpc } from "@/components/admin/AdminUI";

type Row = { id: string; author: string; rating: number; comment: string; hidden: boolean; created_at: string;
  product: { id: string; name: string }; shop: { name: string; slug: string } };
type F = "" | "low" | "hidden";

/** Buyer reviews: the team can hide abusive ones (shops never can). */
export default function AdminReviews() {
  const { t, lang } = useI18n();
  const [f, setF] = useState<F>("");
  const { data, reload } = useAdminRpc<Row[]>("admin_reviews", { p_filter: f });
  return (
    <div className="space-y-3">
      <Chips value={f} onChange={setF} options={[{ key: "", label: t("all") }, { key: "low", label: t("adm_f_low") }, { key: "hidden", label: t("adm_f_hidden_reviews") }]} />
      {!data ? <div className="py-16 text-center"><Spinner /></div> : data.length === 0 ? <Empty /> : (
        <ul className="space-y-2">
          {data.map((r) => (
            <li key={r.id} className={`rounded-2xl border border-line bg-surface p-3 shadow-sm ${r.hidden ? "opacity-60" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><b dir="auto">{r.author}</b><Stars value={r.rating} />{r.hidden ? <Pill>{t("adm_review_hidden")}</Pill> : null}</span>
                <span className="text-xs text-muted">{formatDate(r.created_at, lang)}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted"><Link href={`/p/${r.product.id}`} target="_blank" className="text-brand">{r.product.name}</Link> · {r.shop.name}</p>
              {r.comment ? <p className="mt-1 text-sm" dir="auto">{r.comment}</p> : null}
              <button type="button" onClick={async () => { if (await adminCall("admin_set_review_hidden", { p_review: r.id, p_hidden: !r.hidden })) await reload(); }}
                className={`mt-2 text-sm font-semibold underline ${r.hidden ? "text-brand" : "text-danger"}`}>{r.hidden ? t("adm_show") : t("adm_hide")}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
