"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { isConfigured } from "@/lib/env";
import { Button, Field, Input } from "@/components/ui";

export function AuthForm({ mode }: { mode: "login" | "signup" | "forgot" | "reset" }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"buyer" | "seller">(params.get("role") === "seller" ? "seller" : "buyer");
  const rawNext = params.get("next") || "";
  const safeNext = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const sb = supabase();
    const origin = window.location.origin;
    try {
      if (mode === "login") {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) { setMsg({ ok: false, text: t("bad_login") }); return; }
        const isSeller = data.user?.user_metadata?.role === "seller";
        router.replace(safeNext || (isSeller ? "/seller" : "/"));
        router.refresh();
      } else if (mode === "signup") {
        const dest = role === "seller" ? "/seller" : safeNext || "/";
        const { data, error } = await sb.auth.signUp({
          email, password,
          options: {
            data: { language: lang, role, full_name: fullName.trim() },
            emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(dest)}`,
          },
        });
        if (error) { setMsg({ ok: false, text: error.message }); return; }
        if (data.session) { router.replace(dest); router.refresh(); }
        else setMsg({ ok: true, text: t("check_email") });
      } else if (mode === "forgot") {
        await sb.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/reset` });
        setMsg({ ok: true, text: t("reset_sent") });
      } else {
        const { error } = await sb.auth.updateUser({ password });
        if (error) { setMsg({ ok: false, text: error.message }); return; }
        router.replace("/seller");
      }
    } catch {
      setMsg({ ok: false, text: t("error") });
    } finally {
      setBusy(false);
    }
  }

  const title = { login: t("login"), signup: t("signup"), forgot: t("forgot"), reset: t("new_password") }[mode];
  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="font-display text-3xl">{title}</h1>
      {!isConfigured ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{t("not_configured")}</p> : null}
      {mode === "signup" ? (
        <>
          <fieldset>
            <legend className="mb-1 text-sm font-semibold">{t("i_want")}</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["buyer", "seller"] as const).map((r) => (
                <label key={r} className={`cursor-pointer rounded-2xl border p-3 ${role === r ? "border-brand bg-brand-soft" : "border-line bg-surface"}`}>
                  <input type="radio" name="role" className="sr-only" checked={role === r} onChange={() => setRole(r)} />
                  <span className="block text-2xl">{r === "buyer" ? "🧺" : "🏪"}</span>
                  <span className="block font-semibold">{r === "buyer" ? t("role_buy") : t("role_sell")}</span>
                  <span className="block text-xs text-muted">{r === "buyer" ? t("role_buy_sub") : t("role_sell_sub")}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label={t("customer_name")}>
            <Input required minLength={2} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
        </>
      ) : null}
      {mode !== "reset" ? (
        <Field label={t("email")}>
          <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
        </Field>
      ) : null}
      {mode !== "forgot" ? (
        <Field label={mode === "reset" ? t("new_password") : t("password")} hint={mode === "login" ? undefined : t("password_hint")}>
          <Input type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
        </Field>
      ) : null}
      {msg ? <p className={`text-sm ${msg.ok ? "text-ok" : "text-danger"}`} role="status">{msg.text}</p> : null}
      <Button type="submit" disabled={busy} className="w-full">
        {mode === "login" ? t("login") : mode === "signup" ? t("signup") : mode === "forgot" ? t("reset_send") : t("save_password")}
      </Button>
      <div className="space-y-2 pt-2 text-center text-sm">
        {mode === "login" ? (
          <>
            <p><Link href="/forgot" className="text-brand underline">{t("forgot")}</Link></p>
            <p className="text-muted">{t("no_account")} <Link href={`/signup${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""}`} className="font-semibold text-brand">{t("signup")}</Link></p>
          </>
        ) : mode === "signup" ? (
          <p className="text-muted">{t("have_account")} <Link href={`/login${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""}`} className="font-semibold text-brand">{t("login")}</Link></p>
        ) : (
          <p><Link href="/login" className="text-brand underline">{t("back")}</Link></p>
        )}
      </div>
    </form>
  );
}
