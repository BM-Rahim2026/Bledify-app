import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendNewOrderEmail } from "@/lib/server/email";
import type { Lang } from "@/lib/i18n/dict";

// Online payments go through Chargily Pay (CIB / Edahabia) into Bledify's account.
// Facts from Chargily's official SDK (@chargily/chargily-pay 2.1.0): base URLs below, Bearer secret key,
// POST /checkouts -> { id, checkout_url, status }, GET /checkouts/:id, webhook header "signature" =
// HMAC-SHA256(raw body, secret key) in hex. The webhook's event type is not trusted: the checkout is
// re-read from Chargily and its own status decides.
const TEST_URL = "https://pay.chargily.net/test/api/v2";
const LIVE_URL = "https://pay.chargily.net/api/v2";

export type PaymentMode = "chargily" | "test" | "off";
export type CardType = "cib" | "edahabia";

export function paymentMode(): PaymentMode {
  if (process.env.CHARGILY_SECRET_KEY) return "chargily";
  // simulated payments, never in production
  if (process.env.PAYMENTS_FAKE === "1" && process.env.VERCEL_ENV !== "production") return "test";
  return "off";
}

const base = () => (process.env.CHARGILY_MODE === "live" ? LIVE_URL : TEST_URL);

async function chargily<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${base()}/${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${process.env.CHARGILY_SECRET_KEY}`, "Content-Type": "application/json", Accept: "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`chargily ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<T>;
}

type Checkout = { id: string; checkout_url: string; status: "pending" | "processing" | "paid" | "failed" | "canceled"; amount: number };

export function verifyChargilySignature(raw: string, signature: string | null): boolean {
  const key = process.env.CHARGILY_SECRET_KEY;
  if (!key || !signature) return false;
  const digest = Buffer.from(createHmac("sha256", key).update(raw).digest("hex"), "utf8");
  const given = Buffer.from(signature, "utf8");
  return given.length === digest.length && timingSafeEqual(digest, given);
}

/** Creates the online payment for an order and returns where to send the buyer. */
export async function startPayment(db: SupabaseClient, o: { id: string; number: string; amount_online_dzd: number },
  origin: string, lang: Lang, card: CardType): Promise<string> {
  const mode = paymentMode();
  if (mode === "off") throw new Error("payments_unavailable");
  if (mode === "test") {
    await db.rpc("attach_checkout", { p_order: o.id, p_checkout: `test_${o.id}` });
    return `/pay/test/${o.id}`;
  }
  const c = await chargily<Checkout>("checkouts", {
    method: "POST",
    body: {
      amount: o.amount_online_dzd, currency: "dzd", payment_method: card,
      success_url: `${origin}/orders?paid=${o.id}`, failure_url: `${origin}/orders?payfail=${o.id}`,
      webhook_endpoint: `${origin}/api/payments/chargily/webhook`,
      description: `Bledify ${o.number}`, locale: lang === "ar" ? "ar" : "fr",
      metadata: { order_id: o.id, number: o.number }, pass_fees_to_customer: false,
    },
  });
  const { error } = await db.rpc("attach_checkout", { p_order: o.id, p_checkout: c.id });
  if (error) throw error;
  return c.checkout_url;
}

/** Reads a checkout's real status and records it. Returns true when the order is (now) paid. */
export async function syncCheckout(db: SupabaseClient, checkoutId: string, origin: string): Promise<boolean> {
  if (!checkoutId) return false;
  let status: string; let amount: number;
  if (checkoutId.startsWith("test_")) return false; // simulated payments are recorded by /api/payments/test
  try {
    const c = await chargily<Checkout>(`checkouts/${encodeURIComponent(checkoutId)}`);
    status = c.status; amount = Math.round(c.amount);
  } catch { return false; }
  if (status === "paid") return recordPaid(db, checkoutId, amount, origin);
  if (status === "failed" || status === "canceled") await db.rpc("mark_checkout_failed", { p_checkout: checkoutId });
  return false;
}

export async function recordPaid(db: SupabaseClient, checkoutId: string, amount: number, origin: string): Promise<boolean> {
  const { data, error } = await db.rpc("mark_order_paid", { p_checkout: checkoutId, p_amount: amount });
  if (error) { console.error("mark_order_paid", error.message); return false; }
  const r = data as { order_id: string; newly_paid: boolean };
  if (r.newly_paid) await notifyShop(db, r.order_id, origin);
  return true;
}

/** New-order email to the shop (only once the order is visible to it). */
export async function notifyShop(db: SupabaseClient, orderId: string, origin: string) {
  const [{ data: target }, { data: o }] = await Promise.all([
    db.rpc("order_alert_target", { p_order: orderId }),
    db.from("orders").select("number, total_dzd, customer_name, phone, wilaya, items").eq("id", orderId).maybeSingle(),
  ]);
  if (!target?.enabled || !o) return;
  await sendNewOrderEmail({
    to: target.email, lang: (target.language === "ar" ? "ar" : "fr") as Lang, shopName: target.shop_name,
    number: o.number, total: o.total_dzd, orderId, customer: o.customer_name, phone: o.phone, wilaya: o.wilaya,
    items: o.items, siteUrl: process.env.NEXT_PUBLIC_SITE_URL || origin,
  });
}

export const siteOrigin = (reqOrigin: string) => process.env.NEXT_PUBLIC_SITE_URL || reqOrigin;
