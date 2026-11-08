import { NextResponse, type NextRequest } from "next/server";
import { adminSupabase } from "@/lib/supabase/server";
import { siteOrigin, syncCheckout, verifyChargilySignature } from "@/lib/server/payments";

// Chargily Pay webhook: the signature proves it comes from Chargily; the checkout is then re-read
// from Chargily so its real status (not the event body) decides.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyChargilySignature(raw, req.headers.get("signature"))) return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  const db = adminSupabase();
  if (!db) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  let id = "";
  try { id = String(JSON.parse(raw)?.data?.id ?? ""); } catch { /* ignore */ }
  if (id) await syncCheckout(db, id, siteOrigin(req.nextUrl.origin));
  return NextResponse.json({ ok: true });
}
