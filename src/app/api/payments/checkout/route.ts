import { NextResponse, type NextRequest } from "next/server";
import { adminSupabase, serverSupabase } from "@/lib/supabase/server";
import { siteOrigin, startPayment, syncCheckout, type CardType } from "@/lib/server/payments";

// Pay (or retry paying) an unpaid order from "Mes commandes"; also used on return from the payment page
// to record the result without waiting for the webhook ({ sync: true }).
export async function POST(req: NextRequest) {
  const db = adminSupabase();
  if (!db) return NextResponse.json({ error: "error" }, { status: 503 });
  const { data: auth } = await (await serverSupabase()).auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "login_to_order" }, { status: 401 });
  let b: { order_id?: string; card_type?: string; lang?: string; sync?: boolean };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "error" }, { status: 400 }); }

  const origin = siteOrigin(req.nextUrl.origin);
  const { data: o } = await db.rpc("order_to_pay", { p_order: String(b.order_id ?? ""), p_customer: auth.user.id });
  if (!o) return NextResponse.json({ paid: true }); // already paid, expired or not this buyer's: nothing to pay
  if (o.checkout_id && (await syncCheckout(db, o.checkout_id, origin))) return NextResponse.json({ paid: true });
  if (b.sync) return NextResponse.json({ paid: false });
  try {
    const card: CardType = b.card_type === "cib" ? "cib" : "edahabia";
    const url = await startPayment(db, o, origin, b.lang === "ar" ? "ar" : "fr", card);
    return NextResponse.json({ checkout_url: url });
  } catch {
    return NextResponse.json({ error: "payments_unavailable" }, { status: 503 });
  }
}
