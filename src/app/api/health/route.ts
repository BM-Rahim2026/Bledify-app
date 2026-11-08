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
  const { error } = await anonSupabase().rpc("get_public_shop", { p_slug: "__health__" });
  return NextResponse.json({ ok: !error, db: error ? "error" : "ok", ai, payments }, { status: error ? 503 : 200 });
}
