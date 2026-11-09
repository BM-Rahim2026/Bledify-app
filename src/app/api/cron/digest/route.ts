import { NextResponse, type NextRequest } from "next/server";
import { adminSupabase } from "@/lib/supabase/server";
import { emailEnabled, sendDigestEmail, sendTeamDigest } from "@/lib/server/email";
import { siteOrigin } from "@/lib/server/payments";
import type { Lang } from "@/lib/i18n/dict";
import type { Notification } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Pending = { user_id: string; email: string; lang: Lang; items: Notification[] };

/**
 * Daily email digest (Vercel Cron, see vercel.json): each person gets their unread notifications once,
 * and the team gets what waits in the admin console. Vercel sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!emailEnabled()) return NextResponse.json({ ok: true, skipped: "RESEND_API_KEY not set" });

  const db = adminSupabase();
  if (!db) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const siteUrl = siteOrigin(req.nextUrl.origin);
  const { data, error } = await db.rpc("digest_pending", { p_limit: 300 });
  if (error) return NextResponse.json({ error: "db" }, { status: 500 });

  let sent = 0;
  for (const p of (data ?? []) as Pending[]) {
    if (!(await sendDigestEmail({ to: p.email, lang: p.lang, siteUrl, items: p.items }))) continue;
    await db.rpc("digest_mark_sent", { p_ids: p.items.map((i) => i.id) });
    sent++;
  }

  const { data: team } = await db.rpc("team_digest");
  const t = team as { counts: Record<string, number>; emails: string[] } | null;
  const teamSent = t?.emails.length ? await sendTeamDigest({ to: t.emails, siteUrl, counts: t.counts }) : false;

  return NextResponse.json({ ok: true, sent, team: teamSent });
}
