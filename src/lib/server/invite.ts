import "server-only";
import { NextResponse } from "next/server";
import { anonSupabase } from "@/lib/supabase/server";
import { INVITE_COOKIE, PASS_COOKIE, makePass, normInvite, passCookie } from "@/lib/server/pass";

/** Valid code → sets the guest pass and remembers the code for the account to join with. */
export async function admitWithCode(raw: string, res: NextResponse): Promise<boolean> {
  const code = normInvite(raw);
  if (code.length !== 8) return false;
  const { data, error } = await anonSupabase().rpc("check_invite", { p_code: code });
  if (error || data !== true) return false;
  res.cookies.set(PASS_COOKIE, makePass("guest"), passCookie);
  res.cookies.set(INVITE_COOKIE, code, { ...passCookie, maxAge: 60 * 60 * 24 * 30 });
  return true;
}
