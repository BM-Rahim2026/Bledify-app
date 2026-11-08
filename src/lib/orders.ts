export type OrderStatus =
  | "new" | "confirmed" | "shipped" | "delivered" | "cancelled" | "returned"
  | "pending" | "ready"; // legacy, display only

export const SETTABLE: OrderStatus[] = ["new", "confirmed", "shipped", "delivered", "cancelled", "returned"];
export const TABS = ["all", ...SETTABLE] as const;

export type OrderItem = { product_id?: string | null; name: string; unit_price_dzd: number; quantity: number };
export type HistoryEntry = { status: OrderStatus | "no_answer"; at: string };

export type Order = {
  id: string; number: string; owner_id: string; shop_id: string;
  customer_name: string; phone: string; wilaya: string; commune: string; address: string;
  delivery_type: "home" | "desk"; items: OrderItem[]; delivery_dzd: number; total_dzd: number;
  note: string; status: OrderStatus; history: HistoryEntry[]; no_answer_count: number;
  carrier: string; tracking_number: string; source: "shop" | "manual";
  created_at: string; updated_at: string; risk?: boolean;
};

export const STATUS_COLOR: Record<string, string> = {
  new: "bg-sky-600", confirmed: "bg-indigo-600", shipped: "bg-amber-600",
  delivered: "bg-emerald-600", cancelled: "bg-stone-500", returned: "bg-rose-600",
  pending: "bg-sky-600", ready: "bg-indigo-600", no_answer: "bg-stone-400",
};

/** The one-tap next steps shown on each order card. */
export function nextSteps(s: OrderStatus): OrderStatus[] {
  switch (s) {
    case "confirmed": case "ready": return ["shipped"];
    case "shipped": return ["delivered", "returned"];
    default: return [];
  }
}

export const itemsTotal = (items: OrderItem[]) =>
  items.reduce((sum, it) => sum + (Number(it.unit_price_dzd) || 0) * (Number(it.quantity) || 0), 0);

/** Supabase error → i18n key. */
export function errorKey(e: { code?: string; message?: string } | null | undefined): string {
  if (!e) return "error";
  if (e.code === "P0409" || e.message === "DUPLICATE_ORDER") return e.message === "DUPLICATE_ORDER" ? "err_duplicate" : "err_not_new";
  if (e.code === "P0429") return "err_rate";
  if (e.message === "INVALID_PHONE") return "err_phone";
  if (e.message === "NO_DELIVERY") return "err_no_delivery";
  if (e.code === "P0002") return "err_not_found";
  return "error";
}
