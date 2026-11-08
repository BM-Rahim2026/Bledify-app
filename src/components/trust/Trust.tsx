"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { Icon } from "@/components/Icon";

/** ★★★★☆ — `value` may be fractional (rounded to the nearest half for display). */
export function Stars({ value, className = "h-4 w-4" }: { value: number; className?: string }) {
  const v = Math.round(value * 2) / 2;
  return (
    <span className="inline-flex items-center text-gold" aria-label={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="relative inline-block">
          <Icon name="star" className={`${className} text-gold/30`} fill="currentColor" strokeWidth={0} />
          {v >= i - 0.5 ? (
            <span className="absolute inset-0 overflow-hidden" style={{ width: v >= i ? "100%" : "50%" }}>
              <Icon name="star" className={className} fill="currentColor" strokeWidth={0} />
            </span>
          ) : null}
        </span>
      ))}
    </span>
  );
}

/** "★ 4.8 (12 avis)" — nothing when there are no reviews yet. */
export function RatingSummary({ rating, count, size = "sm" }: { rating?: number | string | null; count?: number | null; size?: "sm" | "md" }) {
  const { t } = useI18n();
  if (!count || rating == null) return null;
  const r = Number(rating);
  return (
    <span className={`inline-flex items-center gap-1.5 ${size === "md" ? "text-sm" : "text-xs"}`}>
      <Stars value={r} className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} />
      <b className="text-ink">{r.toFixed(1).replace(/\.0$/, "")}</b>
      <span className="text-muted">({t("reviews_count", { n: count })})</span>
    </span>
  );
}

export function VerifiedBadge({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <span title={t("verified_hint")} className={`relative inline-flex shrink-0 items-center gap-1 rounded-full bg-brand text-white ${compact ? "p-0.5" : "px-2 py-0.5 text-xs font-semibold"}`}>
      <Icon name="check" className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={3} />
      {compact ? <span className="sr-only">{t("verified")}</span> : t("verified")}
    </span>
  );
}

export type Review = { id: string; author: string; rating: number; comment: string; created_at: string; product_name?: string };

export function ReviewList({ reviews, rating, count, showProduct = false }: {
  reviews: Review[]; rating?: number | string | null; count?: number | null; showProduct?: boolean;
}) {
  const { t, lang } = useI18n();
  const [all, setAll] = useState(false);
  const shown = all ? reviews : reviews.slice(0, 4);
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="font-display text-2xl">{t("reviews_title")}</h2>
        <RatingSummary rating={rating} count={count} size="md" />
      </div>
      {reviews.length ? (
        <ul className="space-y-3">
          {shown.map((r) => (
            <li key={r.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold" dir="auto">{r.author}</span>
                <span className="text-xs text-muted">{formatDate(r.created_at, lang)}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <Stars value={r.rating} />
                {showProduct && r.product_name ? <span className="truncate text-xs text-muted">{t("review_on", { product: r.product_name })}</span> : null}
              </div>
              {r.comment ? <p className="mt-2 text-sm leading-relaxed text-ink/90" dir="auto">{r.comment}</p> : null}
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted">{t("no_reviews")}</p>}
      {reviews.length > shown.length ? (
        <button type="button" onClick={() => setAll(true)} className="mt-3 w-full rounded-xl border border-line bg-surface py-2.5 text-sm font-semibold text-brand">{t("reviews_show_all")}</button>
      ) : null}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><Icon name="shield" className="h-4 w-4 text-brand" />{t("reviews_only_buyers")}</p>
    </section>
  );
}
