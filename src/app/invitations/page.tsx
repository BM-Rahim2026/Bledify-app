"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicNav } from "@/components/PublicNav";
import { toast } from "@/components/Toast";
import { Button, Card, Spinner } from "@/components/ui";

type Mine = {
  quota: number; created: number; access: boolean;
  invites: { code: string; uses: number; max_uses: number; expires_at: string | null; revoked: boolean; created_at: string; usable: boolean; joined: string[] }[];
};
const show = (c: string) => `${c.slice(0, 4)}-${c.slice(4)}`;

/** A member's invitations: create (within the quota), share by link / WhatsApp, see who joined. */
export default function Invitations() {
  const { t, lang } = useI18n();
  const [m, setM] = useState<Mine | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => supabase().rpc("my_invites").then(({ data }) => setM(data as Mine)), []);
  useEffect(() => { void load(); }, [load]);

  const link = (c: string) => `${window.location.origin}/i/${show(c)}`;
  const shareText = (c: string) => t("myinv_share_text", { link: link(c), code: show(c) });
  const left = m ? Math.max(0, m.quota - m.created) : 0;
  const date = (d: string) => new Intl.DateTimeFormat(lang === "ar" ? "ar-DZ" : "fr-DZ", { day: "numeric", month: "short" }).format(new Date(d));

  return (
    <div className="min-h-dvh pb-24">
      <PublicHeader />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <h1 className="font-display text-3xl">{t("myinv_title")}</h1>
        <p className="text-muted">{t("myinv_sub")}</p>
        {!m ? <div className="py-10 text-center"><Spinner /></div> : (
          <>
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-3xl font-bold text-brand">{left}</p>
                <p className="text-sm text-muted">{t("myinv_left", { n: m.quota })}</p>
              </div>
              <Button disabled={busy || left === 0 || !m.access} onClick={async () => {
                setBusy(true);
                const { error } = await supabase().rpc("create_my_invite");
                setBusy(false);
                if (error) toast(t(error.message.includes("INVITE_QUOTA") ? "myinv_quota" : "error"), "error");
                else { toast(t("myinv_created")); await load(); }
              }}>+ {t("myinv_create")}</Button>
            </Card>
            {m.invites.length === 0 ? <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">{t("myinv_empty")}</p> : (
              <ul className="space-y-3">
                {m.invites.map((i) => (
                  <li key={i.code} className="rounded-2xl border border-line bg-surface p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xl font-bold tracking-widest" dir="ltr">{show(i.code)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${i.joined.length ? "bg-emerald-50 text-ok" : i.usable ? "bg-gold-soft text-ink" : "bg-stone-100 text-muted"}`}>
                        {i.joined.length ? t("myinv_joined", { name: i.joined.join(", ") }) : i.usable ? t("myinv_waiting") : t("myinv_expired")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">{date(i.created_at)}{i.expires_at && i.usable ? ` · ${t("myinv_until", { date: date(i.expires_at) })}` : ""}</p>
                    {i.usable ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a href={`https://wa.me/?text=${encodeURIComponent(shareText(i.code))}`} target="_blank" rel="noreferrer"
                          className="inline-flex min-h-9 items-center rounded-xl bg-[#25D366] px-3 text-sm font-semibold text-white">WhatsApp</a>
                        <Button size="sm" variant="secondary" onClick={async () => { await navigator.clipboard.writeText(link(i.code)); toast(t("myinv_copied")); }}>{t("myinv_copy")}</Button>
                        {"share" in navigator ? (
                          <Button size="sm" variant="ghost" onClick={() => navigator.share({ text: shareText(i.code) }).catch(() => {})}>{t("myinv_share")}</Button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
      <PublicNav />
    </div>
  );
}
