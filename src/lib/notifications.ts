import { translate, type DictKey, type Lang } from "@/lib/i18n/dict";
import { formatDZD } from "@/lib/format";

export type Notification = {
  id: number; kind: string; params: Record<string, string | number>; link: string; read: boolean; created_at: string;
};

export const WARNING_REASONS = ["imported", "late_shipping", "cancellations", "quality", "listing_rules", "outside_contact", "behaviour", "other"] as const;
export type WarningReason = (typeof WARNING_REASONS)[number];

/** Sentence for a notification, in the reader's language (used by the bell page and the email digest). */
export function notificationText(lang: Lang, n: Pick<Notification, "kind" | "params">): string {
  const p = n.params ?? {};
  const vars: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(p)) vars[k] = v ?? "";
  if (typeof p.total === "number") vars.total = formatDZD(p.total);
  if (typeof p.amount === "number") vars.amount = formatDZD(p.amount);
  if ("title_fr" in p) vars.title = String(lang === "ar" ? p.title_ar : p.title_fr);
  if (n.kind.startsWith("shop_warning_")) vars.reason = translate(lang, `warn_r_${p.reason}` as DictKey);
  const key = `ntf_${n.kind}` as DictKey;
  const s = translate(lang, key, vars);
  return (s === key ? n.kind : s).replace(/\s{2,}/g, " ").replace(/\s+([.,])/g, "$1").trim();
}

/** Icon name for a notification kind. */
export function notificationIcon(kind: string): string {
  if (kind.startsWith("order_")) return kind === "order_new" ? "bag" : "truck";
  if (kind.startsWith("payout")) return "cash";
  if (kind.startsWith("offer_")) return "gift";
  if (kind.startsWith("report_") || kind.startsWith("shop_warning") || kind === "shop_suspended" || kind === "product_blocked") return "shield";
  return "store";
}
