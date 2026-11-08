"use client";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useI18n, LangSwitch } from "@/lib/i18n";
import { useSession } from "@/lib/useSession";
import { normalizePhone } from "@/lib/format";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicNav } from "@/components/PublicNav";
import { Button, Card, Field, Input, Spinner } from "@/components/ui";

export default function Account() {
  const { t } = useI18n();
  const user = useSession();
  const [hasShop, setHasShop] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    queueMicrotask(() => { setName(user.user_metadata?.full_name ?? ""); setPhone(user.user_metadata?.phone ?? ""); });
    supabase().from("shops").select("id").maybeSingle().then(({ data }) => setHasShop(Boolean(data)));
  }, [user]);

  if (user === undefined) return <div className="flex min-h-dvh items-center justify-center"><Spinner /></div>;
  if (!user) { if (typeof window !== "undefined") window.location.replace("/login?next=/account"); return null; }

  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <h1 className="font-display text-3xl">{t("hello_name", { name: name.split(" ")[0] || user.email?.split("@")[0] || "" })}</h1>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/orders" className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-4 font-semibold"><Icon name="bag" className="h-5 w-5 text-brand" />{t("my_orders")}</Link>
          <Link href="/favorites" className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-4 font-semibold"><Icon name="heart" className="h-5 w-5 text-rose-600" />{t("favorites")}</Link>
          <Link href="/confiance" className="col-span-2 flex items-center gap-2 rounded-2xl border border-line bg-surface p-4 font-semibold"><Icon name="shield" className="h-5 w-5 text-brand" />{t("trust_title")}</Link>
          <Link href="/seller" className="col-span-2 rounded-2xl border border-line bg-surface p-4 font-semibold">
            <span className="flex items-center gap-2"><Icon name="store" className="h-5 w-5 text-brand" />{hasShop ? t("my_shop") : t("sell_cta")}</span>
          </Link>
        </div>

        <Card>
          <h2 className="mb-3 font-semibold">{t("profile")}</h2>
          <form className="space-y-3" onSubmit={async (e) => {
            e.preventDefault();
            setMsg(null);
            if (phone && !normalizePhone(phone)) { setMsg(t("err_phone")); return; }
            const { error } = await supabase().auth.updateUser({ data: { full_name: name.trim(), phone } });
            setMsg(error ? t("error") : t("saved"));
          }}>
            <Field label={t("customer_name")}><Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
            <Field label={t("phone")}><Input type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></Field>
            <p className="text-sm text-muted" dir="ltr">{user.email}</p>
            {msg ? <p className="text-sm" role="status">{msg}</p> : null}
            <Button type="submit">{t("save")}</Button>
          </form>
        </Card>

        <Card className="flex items-center justify-between">
          <span className="font-semibold">{t("language")}</span>
          <LangSwitch />
        </Card>
        <Button variant="danger" className="w-full" onClick={async () => { await supabase().auth.signOut(); window.location.assign("/"); }}>{t("logout")}</Button>
      </main>
      <PublicNav />
    </div>
  );
}
