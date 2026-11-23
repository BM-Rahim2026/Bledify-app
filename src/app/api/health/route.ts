import { NextResponse } from "next/server";
import { anonSupabase } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/env";
import { paymentMode } from "@/lib/server/payments";

export const dynamic = "force-dynamic";

export async function GET() {
  // reports only whether the AI key is present, never its value
  const ai = process.env.ANTHROPIC_API_KEY ? "configured" : "not_configured";
  const payments = paymentMode() === "chargily" ? `chargily_${process.env.CHARGILY_MODE === "live" ? "live" : "test"}` : paymentMode();
  if (!isConfigured) return NextResponse.json({ ok: false, db: "not_configured", ai, payments }, { status: 503 });
  const { data: inviteOnly, error } = await anonSupabase().rpc("invite_only");
  // "masked": a visitor's direct request for the catalog is refused by the database
  const probe = await anonSupabase().rpc("public_home");
  // wilaya_km stays callable by visitors, so only the API gate (pre-request hook) can refuse it
  const gate = await anonSupabase().rpc("wilaya_km", { a: 16, b: 31 });
  const masked = inviteOnly ? Boolean(probe.error) && Boolean(gate.error) : null;
  return NextResponse.json({ ok: !error, db: error ? "error" : "ok", ai, payments, invite_only: inviteOnly ?? null, masked },
    { status: error ? 503 : 200 });
}
