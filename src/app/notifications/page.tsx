"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/useSession";
import { notificationIcon, notificationText, type Notification } from "@/lib/notifications";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicNav } from "@/components/PublicNav";
import { Icon } from "@/components/Icon";
import { Spinner } from "@/components/ui";

export default function NotificationsPage() {
  const { t, lang } = useI18n();
  const user = useSession();
  const [list, setList] = useState<Notification[] | null>(null);
  const [digest, setDigest] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    const sb = supabase();
    sb.rpc("my_notifications", { p_limit: 100 }).then(({ data }) => {
      setList((data as Notification[]) ?? []);
      if ((data as Notification[] | null)?.some((x) => !x.read)) void sb.rpc("mark_notifications_read", { p_ids: null });
    });
    sb.rpc("my_settings").then(({ data }) => setDigest((data as { email_digest?: boolean } | null)?.email_digest ?? true));
  }, [user]);

  if (user === undefined) return <div className="flex min-h-dvh items-center justify-center"><Spinner /></div>;
  if (!user) { if (typeof window !== "undefined") window.location.replace("/login?next=/notifications"); return null; }

  const when = (d: string) => new Intl.DateTimeFormat(lang === "ar" ? "ar-DZ" : "fr-DZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Africa/Algiers" }).format(new Date(d));

  return (
    <div className="min-h-dvh pb-24">
      <PublicHeader />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <h1 className="font-display text-3xl">{t("notifications")}</h1>
        {list === null ? <div className="py-10 text-center"><Spinner /></div> : list.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">{t("ntf_empty")}</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {list.map((n) => {
              const body = (
                <div className="flex gap-3 p-4">
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${n.read ? "bg-sand text-muted" : "bg-brand-soft text-brand"}`}>
                    <Icon name={notificationIcon(n.kind)} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[15px] ${n.read ? "" : "font-semibold"}`}>{notificationText(lang, n)}</p>
                    <p className="mt-0.5 text-xs text-muted">{when(n.created_at)}</p>
                  </div>
                  {n.read ? null : <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-label={t("ntf_unread")} />}
                </div>
              );
              return <li key={n.id}>{n.link ? <Link href={n.link} className="block hover:bg-sand/60">{body}</Link> : body}</li>;
            })}
          </ul>
        )}
        {digest === null ? null : (
          <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-brand" checked={digest}
              onChange={(e) => { setDigest(e.target.checked); void supabase().rpc("save_my_settings", { p_email_digest: e.target.checked }); }} />
            <span><span className="block font-semibold">{t("ntf_email_digest")}</span><span className="text-sm text-muted">{t("ntf_email_digest_hint")}</span></span>
          </label>
        )}
      </main>
      <PublicNav />
    </div>
  );
}
