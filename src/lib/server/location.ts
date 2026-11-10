import "server-only";
import { cookies, headers } from "next/headers";
import { LOC_COOKIE, parseLoc, type Loc } from "@/lib/geo";
import { WILAYA_COORDS } from "@/lib/geo-coords";

/** Approximate wilaya from the connection (Vercel geo headers; DZ regions are wilaya numbers). */
export async function ipWilaya(): Promise<number | null> {
  const h = await headers();
  if (h.get("x-vercel-ip-country") !== "DZ") return null;
  const code = Number((h.get("x-vercel-ip-country-region") ?? "").replace(/^DZ-/, ""));
  return WILAYA_COORDS[code] ? code : null;
}

/** The person's location: chosen / GPS (cookie), else approximated from the connection. */
export async function getLocation(): Promise<Loc | null> {
  const saved = parseLoc((await cookies()).get(LOC_COOKIE)?.value);
  if (saved) return saved;
  const code = await ipWilaya();
  return code ? { code, source: "ip" } : null;
}
