"use client";
import { supabase } from "@/lib/supabase/client";
import { useI18n, LangSwitch } from "@/lib/i18n";
import { useSeller } from "@/lib/seller";
import { Button, Card } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { ShopForm } from "@/components/ShopForm";
import { LogoPicker } from "@/components/LogoPicker";
import { useEffect } from "react";

export default function Settings() {
  const { t, lang } = useI18n();
  const { shop, user, reloadShop } = useSeller();

  // remember the seller's language on the account
  useEffect(() => {
    if (user.user_metadata?.language !== lang) void supabase().auth.updateUser({ data: { language: lang } });
  }, [lang, user]);

  return (
    <>
      <PageHeader title={t("nav_shop")} />
      <div className="space-y-4 p-4">
        <Card className="flex items-center justify-between">
          <span className="font-semibold">{t("language")}</span>
          <LangSwitch />
        </Card>
        <LogoPicker shop={shop} onSaved={reloadShop} />
        <Card><ShopForm shop={shop} ownerId={user.id} onSaved={reloadShop} /></Card>
        <Card className="flex items-center justify-between">
          <span className="truncate text-sm text-muted" dir="ltr">{user.email}</span>
          <Button variant="danger" size="sm" onClick={async () => { await supabase().auth.signOut(); window.location.href = "/"; }}>{t("logout")}</Button>
        </Card>
      </div>
    </>
  );
}
