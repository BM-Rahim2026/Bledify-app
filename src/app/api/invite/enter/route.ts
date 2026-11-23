import { NextResponse, type NextRequest } from "next/server";
import { admitWithCode } from "@/lib/server/invite";

/** Code typed on /invite. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { code?: string };
  const signedIn = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  const res = NextResponse.json({ ok: true, next: signedIn ? "/" : "/signup?invited=1" });
  if (await admitWithCode(String(body.code ?? ""), res)) return res;
  return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
}
