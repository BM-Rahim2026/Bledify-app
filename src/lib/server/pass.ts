import { createHmac, timingSafeEqual } from "node:crypto";

// "This browser was let in" cookie, signed so it cannot be forged.
// guest = entered a valid invitation code; member = signed in with an account that has access.
export const PASS_COOKIE = "bl_pass";
export const INVITE_COOKIE = "bl_invite";
export const PASS_MAX_AGE = 60 * 60 * 24 * 60; // 60 days

export type Pass = { kind: "guest" | "member"; uid: string; exp: number };

const secret = () =>
  process.env.ACCESS_COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_JWT_SECRET || "";

const sign = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

export function makePass(kind: Pass["kind"], uid = "-"): string {
  const body = `v1.${kind === "member" ? "m" : "g"}.${uid}.${Math.floor(Date.now() / 1000) + PASS_MAX_AGE}`;
  return `${body}.${sign(body)}`;
}

export function readPass(v: string | undefined): Pass | null {
  if (!v || !secret()) return null;
  const i = v.lastIndexOf(".");
  const body = v.slice(0, i), sig = v.slice(i + 1);
  const want = sign(body);
  if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  const [ver, k, uid, exp] = body.split(".");
  if (ver !== "v1" || Number(exp) * 1000 < Date.now()) return null;
  return { kind: k === "m" ? "member" : "guest", uid, exp: Number(exp) };
}

export const passCookie = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: PASS_MAX_AGE };

/** Canonical invitation code: letters/digits only, upper case ("bled-7k2m" → "BLED7K2M"). */
export const normInvite = (c: string) => (c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
/** Display form: "7K2M-9XQP". */
export const showInvite = (c: string) => (c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c);
