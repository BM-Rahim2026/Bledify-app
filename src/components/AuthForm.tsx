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
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) { setMsg({ ok: false, text: t("bad_login") }); return; }
        router.replace(params.get("next") || "/seller");
        router.refresh();
      } else if (mode === "signup") {
        const { data, error } = await sb.auth.signUp({
          email, password,
          options: { data: { language: lang }, emailRedirectTo: `${origin}/auth/callback?next=/seller` },
        });
        if (error) { setMsg({ ok: false, text: error.message }); return; }
        if (data.session) { router.replace("/seller"); router.refresh(); }
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
            <p className="text-muted">{t("no_account")} <Link href="/signup" className="font-semibold text-brand">{t("signup")}</Link></p>
          </>
        ) : mode === "signup" ? (
          <p className="text-muted">{t("have_account")} <Link href="/login" className="font-semibold text-brand">{t("login")}</Link></p>
        ) : (
          <p><Link href="/login" className="text-brand underline">{t("back")}</Link></p>
        )}
      </div>
    </form>
  );
}
