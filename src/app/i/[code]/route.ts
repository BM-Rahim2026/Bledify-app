import { NextResponse, type NextRequest } from "next/server";
import { admitWithCode } from "@/lib/server/invite";

/** Invitation link https://…/i/7K2M-9XQP → let in, then create the account (or go home when signed in). */
export async function GET(request: NextRequest, ctx: RouteContext<"/i/[code]">) {
  const { code } = await ctx.params;
  const signedIn = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  const ok = NextResponse.redirect(new URL(signedIn ? "/" : "/signup?invited=1", request.url));
  if (await admitWithCode(code, ok)) return ok;
  const bad = new URL("/invite", request.url);
  bad.searchParams.set("error", "invalid");
  bad.searchParams.set("code", code.slice(0, 16));
  return NextResponse.redirect(bad);
}
