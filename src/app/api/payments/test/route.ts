import { NextResponse, type NextRequest } from "next/server";
import { adminSupabase, serverSupabase } from "@/lib/supabase/server";
import { paymentMode, recordPaid, siteOrigin } from "@/lib/server/payments";

// Simulated payment page (only with PAYMENTS_FAKE=1 outside production).
export async function POST(req: NextRequest) {
  if (paymentMode() !== "test") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const db = adminSupabase();
  const { data: auth } = await (await serverSupabase()).auth.getUser();
  if (!db || !auth.user) return NextResponse.json({ error: "login_to_order" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { order_id?: string; ok?: boolean };
  const { data: o } = await db.rpc("order_to_pay", { p_order: String(b.order_id ?? ""), p_customer: auth.user.id });
  if (!o) return NextResponse.json({ paid: true });
  if (b.ok) await recordPaid(db, o.checkout_id, o.amount_online_dzd, siteOrigin(req.nextUrl.origin));
  else await db.rpc("mark_checkout_failed", { p_checkout: o.checkout_id });
  return NextResponse.json({ paid: Boolean(b.ok) });
}
