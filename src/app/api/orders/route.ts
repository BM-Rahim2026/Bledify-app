import { NextResponse, after, type NextRequest } from "next/server";
import { adminSupabase, serverSupabase } from "@/lib/supabase/server";
import { errorKey } from "@/lib/orders";
import { notifyShop, paymentMode, siteOrigin, startPayment, type CardType } from "@/lib/server/payments";
import type { Lang } from "@/lib/i18n/dict";

// Order from a signed-in customer. Runs place_order with the service role so the database can
// rate-limit by IP; prices, deposits and the amount to pay online all come from the database.
// When something is due online, the buyer is sent to the payment page (Chargily) right away.
export async function POST(req: NextRequest) {
  const db = adminSupabase();
  if (!db) return NextResponse.json({ error: "error" }, { status: 503 });

  const { data: auth } = await (await serverSupabase()).auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "login_to_order" }, { status: 401 });
  // accounts blocked by the Bledify team cannot order
  const { data: blocked } = await db.from("blocked_users").select("user_id").eq("user_id", auth.user.id).maybeSingle();
  if (blocked) return NextResponse.json({ error: "account_blocked" }, { status: 403 });

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "error" }, { status: 400 }); }
  const str = (k: string, max = 200) => String(b[k] ?? "").slice(0, max);
  const items = Array.isArray(b.items)
    ? b.items.slice(0, 30).map((i: { product_id?: unknown; quantity?: unknown }) => ({ product_id: String(i?.product_id ?? ""), quantity: Number(i?.quantity) || 0 }))
    : [];
  const method = str("payment_method", 10) === "card" ? "card" : "cod";
  const card: CardType = str("card_type", 10) === "cib" ? "cib" : "edahabia";
  const lang: Lang = str("lang", 2) === "ar" ? "ar" : "fr";
  if (method === "card" && paymentMode() === "off") return NextResponse.json({ error: "payments_unavailable" }, { status: 422 });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";

  const { data, error } = await db.rpc("place_order", {
    p_slug: str("slug", 60), p_customer_name: str("customer_name", 80), p_phone: str("phone", 30),
    p_wilaya: str("wilaya", 60), p_commune: str("commune", 80), p_address: str("address", 200),
    p_delivery_type: str("delivery_type", 10), p_items: items, p_note: str("note", 500), p_ip: ip,
    p_customer: auth.user.id, p_payment_method: method,
  });

  if (error) {
    const key = errorKey(error);
    const status = error.code === "P0409" ? 409 : error.code === "P0429" ? 429 : error.code === "P0002" ? 404 : error.code === "22023" ? 422 : 500;
    return NextResponse.json({ error: key === "error" && status === 422 ? "required" : key }, { status });
  }

  const order = data as { id: string; number: string; total_dzd: number; amount_online_dzd: number; amount_cod_dzd: number; payment_status: string };
  const origin = siteOrigin(req.nextUrl.origin);
  const body = { id: order.id, number: order.number, total_dzd: order.total_dzd, amount_online_dzd: order.amount_online_dzd, amount_cod_dzd: order.amount_cod_dzd };

  if (order.amount_online_dzd > 0) {
    try {
      const url = await startPayment(db, order, origin, lang, card);
      return NextResponse.json({ ...body, checkout_url: url }, { status: 201 });
    } catch (e) {
      console.error("payment start failed", e);
      // the order stays unpaid (hidden from the shop); the buyer can retry from "Mes commandes"
      return NextResponse.json({ ...body, payment_error: true }, { status: 201 });
    }
  }

  after(() => notifyShop(db, order.id, origin));
  return NextResponse.json(body, { status: 201 });
}
