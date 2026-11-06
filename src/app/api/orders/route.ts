import { NextResponse, after, type NextRequest } from "next/server";
import { adminSupabase, serverSupabase } from "@/lib/supabase/server";
import { errorKey } from "@/lib/orders";
import { sendNewOrderEmail } from "@/lib/server/email";
import type { Lang } from "@/lib/i18n/dict";

// Cash-on-delivery order from a signed-in customer. Runs place_order with the service role so the
// database can rate-limit by the caller's IP; prices are read from the database.
export async function POST(req: NextRequest) {
  const db = adminSupabase();
  if (!db) return NextResponse.json({ error: "error" }, { status: 503 });

  // buying requires an account
  const { data: auth } = await (await serverSupabase()).auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "login_to_order" }, { status: 401 });

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "error" }, { status: 400 }); }
  const str = (k: string, max = 200) => String(b[k] ?? "").slice(0, max);
  const items = Array.isArray(b.items)
    ? b.items.slice(0, 30).map((i: { product_id?: unknown; quantity?: unknown }) => ({ product_id: String(i?.product_id ?? ""), quantity: Number(i?.quantity) || 0 }))
    : [];
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";

  const { data, error } = await db.rpc("place_order", {
    p_slug: str("slug", 60), p_customer_name: str("customer_name", 80), p_phone: str("phone", 30),
    p_wilaya: str("wilaya", 60), p_commune: str("commune", 80), p_address: str("address", 200),
    p_delivery_type: str("delivery_type", 10), p_items: items, p_note: str("note", 500), p_ip: ip,
    p_customer: auth.user.id,
  });

  if (error) {
    const key = errorKey(error);
    const status = error.code === "P0409" ? 409 : error.code === "P0429" ? 429 : error.code === "P0002" ? 404 : error.code === "22023" ? 422 : 500;
    return NextResponse.json({ error: key === "error" && status === 422 ? "required" : key }, { status });
  }

  const order = data as { id: string; number: string; total_dzd: number; items: { name: string; quantity: number }[] };

  // email alert after the response is sent
  after(async () => {
    const { data: target } = await db.rpc("order_alert_target", { p_order: order.id });
    if (!target?.enabled) return;
    await sendNewOrderEmail({
      to: target.email, lang: (target.language === "ar" ? "ar" : "fr") as Lang, shopName: target.shop_name,
      number: order.number, total: order.total_dzd, orderId: order.id, customer: str("customer_name", 80),
      phone: str("phone", 30), wilaya: str("wilaya", 60), items: order.items,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin,
    });
  });

  return NextResponse.json({ number: order.number, total_dzd: order.total_dzd }, { status: 201 });
}
