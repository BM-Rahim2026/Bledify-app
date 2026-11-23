import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { INVITE_COOKIE, PASS_COOKIE, makePass, passCookie, readPass } from "@/lib/server/pass";

// Pages anyone can open while Bledify is invite-only (everything else is masked: members only).
const OPEN = ["/invite", "/i/", "/login", "/forgot", "/reset", "/auth/", "/legal", "/api/"];
// Pages that need a signed-in account.
const SIGNED_IN = ["/seller", "/admin", "/account", "/orders", "/notifications", "/invitations"];
// Routes where the Supabase session cookie is refreshed even when nothing else needs it.
const REFRESH = ["/s/", "/login", "/signup", "/auth/", "/api/orders", "/api/ai/", "/api/invite/"];

const starts = (path: string, list: string[]) => list.some((p) => path === p.replace(/\/$/, "") || path.startsWith(p));

// The gate switch, read from the database at most once a minute per server instance.
let gate = { on: true, at: 0 };
async function inviteOnly(sb: ReturnType<typeof createServerClient>): Promise<boolean> {
  if (Date.now() - gate.at < 60_000) return gate.on;
  const { data, error } = await sb.rpc("invite_only");
  gate = { on: error ? gate.on : data !== false, at: Date.now() };
  return gate.on;
}

// Refreshes the Supabase session cookie, keeps account pages behind login, and lets in only invited people.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return response;
  const path = request.nextUrl.pathname;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const redirect = (to: string, params: Record<string, string> = {}) => {
    const url = request.nextUrl.clone();
    url.pathname = to; url.search = "";
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const r = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => r.cookies.set(c)); // keep refreshed session cookies
    return r;
  };

  const pass = readPass(request.cookies.get(PASS_COOKIE)?.value);
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  const open = starts(path, OPEN);
  // Masked: only signed-in members see the site. A valid code (guest pass) only opens account creation.
  const admitted = pass?.kind === "member" && hasSession;
  const gateCheck = !open && !admitted && (await inviteOnly(supabase));
  const needUser = starts(path, SIGNED_IN) || gateCheck || starts(path, REFRESH);
  const user = needUser ? (await supabase.auth.getUser()).data.user : null;

  if (gateCheck) {
    if (!user) {
      if (path === "/signup" && pass?.kind === "guest") return response;
      return redirect("/invite", path === "/" ? {} : { next: path + request.nextUrl.search });
    }
    const { data } = await supabase.rpc("my_access");
    let ok = Boolean((data as { access?: boolean } | null)?.access);
    const code = request.cookies.get(INVITE_COOKIE)?.value;
    if (!ok && code) ok = !(await supabase.rpc("redeem_invite", { p_code: code })).error;
    if (!ok) return redirect("/invite", { reason: "no_access", next: path });
    response.cookies.set(PASS_COOKIE, makePass("member", user.id), passCookie);
    response.cookies.delete(INVITE_COOKIE);
  }

  if (!user && starts(path, SIGNED_IN)) return redirect("/login", { next: path });
  return response;
}

export const config = {
  // every page, not static files and images
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|home/|.*\\.(?:png|jpg|jpeg|webp|svg|ico|txt|xml|webmanifest|woff2?)$).*)"],
};
