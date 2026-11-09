"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/useSession";
import { Icon } from "@/components/Icon";

/** Bell with the unread count; shown to signed-in people only. Also remembers their language for emails. */
export function NotificationBell({ className = "" }: { className?: string }) {
  const { t, lang } = useI18n();
  const user = useSession();
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = () => supabase().rpc("my_unread_count").then(({ data }) => setN(Number(data) || 0));
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, 60_000);
    return () => clearInterval(timer);
  }, [user]);

  useEffect(() => {
    if (user) void supabase().rpc("save_my_settings", { p_lang: lang });
  }, [user, lang]);

  if (!user) return null;
  return (
    <Link href="/notifications" aria-label={n ? `${t("notifications")} (${n})` : t("notifications")}
      className={`relative rounded-full p-2 text-ink hover:bg-sand ${className}`}>
      <Icon name="bell" className="h-6 w-6" />
      {n ? <span className="absolute end-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">{n > 99 ? "99+" : n}</span> : null}
    </Link>
  );
}
