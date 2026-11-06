// Supabase settings. The Vercel ↔ Supabase integration sets these
// automatically; see .env.example for local development.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";

export function serverSecrets() {
  return {
    url: process.env.SUPABASE_URL || SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "",
    resendKey: process.env.RESEND_API_KEY || "",
    mailFrom: process.env.MAIL_FROM || "Bledify <onboarding@resend.dev>",
  };
}

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
