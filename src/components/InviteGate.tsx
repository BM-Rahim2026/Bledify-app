"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n, LangSwitch } from "@/lib/i18n";
import { supabase } from "@/lib/supabase/client";
import { WILAYAS, wilayaLabel, wilayaValue } from "@/lib/wilayas";
import { Logo } from "@/components/Logo";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";

/** "Bledify is invite-only": enter a code, sign in, or ask for an invitation. */
export function InviteGate({ code: initial, error, reason, next }: { code: string; error: string; reason: string; next: string }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [code, setCode] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(error === "invalid");
  const [ask, setAsk] = useState(false);
  const [req, setReq] = useState({ name: "", contact: "", wilaya: "", role: "buyer", message: "" });
  const [sent, setSent] = useState<"ok" | "error" | null>(null);
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "";

  async function enter(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(false);
    const r = await fetch("/api/invite/enter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
    const body = (await r.json().catch(() => ({}))) as { ok?: boolean; next?: string };
    setBusy(false);
    if (!body.ok) { setErr(true); return; }
    // keep where the person was going (e.g. the seller sign-up link)
    const to = safeNext.startsWith("/signup") && body.next !== "/" ? `${safeNext}${safeNext.includes("?") ? "&" : "?"}invited=1`
      : body.next === "/" && safeNext ? safeNext : body.next ?? "/";
    router.replace(to);
    router.refresh();
  }

  return (
    <div className="space-y-5 text-white">
      <div className="flex items-center justify-between">
        <Logo variant="white" height={34} />
        <LangSwitch className="bg-white/90" />
      </div>
      <div>
        <p className="inline-flex rounded-full bg-gold px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink">{t("inv_badge")}</p>
        <h1 className="mt-3 font-display text-4xl leading-tight">{t("inv_title")}</h1>
        <p className="mt-2 text-white/90">{t("inv_sub")}</p>
      </div>

      <div className="space-y-4 rounded-3xl bg-ivory p-5 text-ink shadow-2xl">
        {reason === "no_access" ? <p className="rounded-xl bg-gold-soft p-3 text-sm" role="status">{t("inv_no_access")}</p> : null}
        <form onSubmit={enter} className="space-y-3">
          <Field label={t("inv_code_label")} error={err ? t("inv_code_invalid") : undefined}>
            <Input required dir="ltr" autoCapitalize="characters" autoComplete="one-time-code" placeholder="7K2M-9XQP" maxLength={16}
              className="text-center font-mono text-xl tracking-[0.2em] uppercase" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full" disabled={busy || code.replace(/[^a-z0-9]/gi, "").length < 8}>{busy ? t("sending") : t("inv_enter")}</Button>
        </form>
        <p className="text-center text-sm text-muted">{t("inv_member")} <Link href={`/login${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""}`} className="font-semibold text-brand">{t("login")}</Link></p>
      </div>

      <div className="rounded-3xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur">
        {sent === "ok" ? (
          <p className="text-center" role="status">{t("inv_req_sent")}</p>
        ) : !ask ? (
          <div className="text-center">
            <p className="font-semibold">{t("inv_no_code")}</p>
            <button type="button" onClick={() => setAsk(true)} className="mt-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand">{t("inv_request")}</button>
          </div>
        ) : (
          <form className="space-y-3 [&_label>span]:text-white" onSubmit={async (e) => {
            e.preventDefault();
            const { error: er } = await supabase().rpc("request_access", { p_name: req.name, p_contact: req.contact, p_wilaya: req.wilaya, p_role: req.role, p_message: req.message });
            setSent(er ? "error" : "ok");
          }}>
            <p className="font-semibold">{t("inv_request")}</p>
            <div className="grid grid-cols-2 gap-2 text-sm font-semibold">
              {(["buyer", "seller"] as const).map((r) => (
                <label key={r} className={`cursor-pointer rounded-xl px-3 py-2 text-center ${req.role === r ? "bg-white text-brand" : "bg-white/10 ring-1 ring-white/30"}`}>
                  <input type="radio" name="role" className="sr-only" checked={req.role === r} onChange={() => setReq({ ...req, role: r })} />
                  {t(r === "buyer" ? "inv_role_buyer" : "inv_role_seller")}
                </label>
              ))}
            </div>
            <Field label={t("customer_name")}><Input required minLength={2} maxLength={80} value={req.name} onChange={(e) => setReq({ ...req, name: e.target.value })} /></Field>
            <Field label={t("inv_contact")}><Input required minLength={5} maxLength={120} dir="ltr" value={req.contact} onChange={(e) => setReq({ ...req, contact: e.target.value })} /></Field>
            <Field label={t("wilaya")}>
              <Select value={req.wilaya} onChange={(e) => setReq({ ...req, wilaya: e.target.value })}>
                <option value="">{t("choose_wilaya")}</option>
                {WILAYAS.map((w) => <option key={w.code} value={wilayaValue(w)}>{wilayaLabel(wilayaValue(w), lang)}</option>)}
              </Select>
            </Field>
            <Field label={`${t("inv_message")} (${t("optional")})`}><Textarea rows={2} maxLength={500} value={req.message} onChange={(e) => setReq({ ...req, message: e.target.value })} /></Field>
            {sent === "error" ? <p className="text-sm text-rose-200" role="alert">{t("error")}</p> : null}
            <Button type="submit" variant="secondary" className="w-full">{t("inv_request_send")}</Button>
          </form>
        )}
      </div>
      <p className="text-center text-xs text-white/70"><Link href="/legal/terms" className="underline">{t("legal_terms")}</Link></p>
    </div>
  );
}
