import { NextResponse } from "next/server";
import { anonSupabase } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isConfigured) return NextResponse.json({ ok: false, db: "not_configured" }, { status: 503 });
  const { error } = await anonSupabase().rpc("get_public_shop", { p_slug: "__health__" });
  return NextResponse.json({ ok: !error, db: error ? "error" : "ok" }, { status: error ? 503 : 200 });
}
