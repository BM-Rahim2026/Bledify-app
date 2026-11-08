import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";

export const AI_MODEL = "claude-opus-5-5";
/** Server-side fallback: if the model declines, the API retries on Anthropic's recommended model. */
export const AI_BETAS = ["server-side-fallback-2026-07-01"];
export const DAILY_AI_LIMIT = 40;

let client: Anthropic | null = null;
export function aiClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic();
  return client;
}

export const BLEDIFY_CONTEXT = `Bledify is a marketplace for Algerian home-based makers (women and men) working from home or in a small workshop: traditional cakes (baklawa, makrout, kalb el louz, dziriettes…), home cooking (hand-rolled couscous, msemen, rechta…), farm products (honey, olive oil, dates), couture (karakou, kaftan, Kabyle dress), crafts (pottery, rugs, copper, weaving), natural beauty (soap, henna) and handmade jewellery. Everything is made in Algeria; buyers pay cash on delivery (COD) and get home or stop-desk delivery across the 58 wilayas, through carriers such as Yalidine or ZR Express. Prices are in Algerian dinars (DA). Sellers share their shop link on Facebook and Instagram and confirm each order by phone or WhatsApp before shipping, because fake orders and refused parcels cost them money.`;

type Gate =
  | { ok: true; sb: Awaited<ReturnType<typeof serverSupabase>>; userId: string; client: Anthropic }
  | { ok: false; res: NextResponse };

/** Signed-in seller + configured API key + one daily credit. */
export async function aiGate(): Promise<Gate> {
  const ai = aiClient();
  if (!ai) return { ok: false, res: NextResponse.json({ error: "ai_not_configured" }, { status: 503 }) };
  const sb = await serverSupabase();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { ok: false, res: NextResponse.json({ error: "login_to_order" }, { status: 401 }) };
  const { error } = await sb.rpc("use_ai_credit", { p_limit: DAILY_AI_LIMIT });
  if (error) {
    const limit = error.code === "P0429";
    return { ok: false, res: NextResponse.json({ error: limit ? "ai_limit" : "error" }, { status: limit ? 429 : 500 }) };
  }
  return { ok: true, sb, userId: data.user.id, client: ai };
}

/** Maps SDK errors to a user-facing i18n key. */
export function aiErrorResponse(e: unknown) {
  if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "ai_busy" }, { status: 429 });
  if (e instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
  if (e instanceof Anthropic.APIError) {
    console.error("[ai] API error", e.status, e.message);
    return NextResponse.json({ error: "error" }, { status: 502 });
  }
  console.error("[ai] error", e);
  return NextResponse.json({ error: "error" }, { status: 500 });
}

/** Only images we host (Supabase storage) or the demo CDN are sent to the model. */
export function allowedImage(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname.endsWith(".supabase.co") || u.hostname === "cdn.openart.ai");
  } catch {
    return false;
  }
}

export const LANG_NAME: Record<string, string> = {
  fr: "French",
  ar: "Modern Standard Arabic (Arabic script)",
  darija_ar: "Algerian Darija written in Arabic script",
  darija_lat: "Algerian Darija written in Latin letters with numbers for Arabic sounds (Arabizi, e.g. 3, 7, 9), the way Algerians write on Facebook",
};
