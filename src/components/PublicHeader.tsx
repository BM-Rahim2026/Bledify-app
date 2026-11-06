"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n, LangSwitch } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { displayName, useSession } from "@/lib/useSession";

/** Top bar for public pages. `overlay` renders it transparent over a hero image. */
export function PublicHeader({ overlay = false }: { overlay?: boolean }) {
  const { t } = useI18n();
  const user = useSession();
  const path = usePathname();
  const next = encodeURIComponent(path);
  const text = overlay ? "text-white" : "text-ink";

  return (
    <header className={`${overlay ? "absolute inset-x-0 top-0 z-20" : "sticky top-0 z-30 border-b border-line bg-sand/90 backdrop-blur"}`}>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" aria-label="Bledify" className="shrink-0"><Logo variant={overlay ? "white" : "color"} height={30} /></Link>
        <nav className={`ms-6 hidden gap-5 text-sm font-semibold md:flex ${text}`}>
          <Link href="/explore" className="hover:opacity-80">{t("explore")}</Link>
          <Link href="/track" className="hover:opacity-80">{t("track_order")}</Link>
          <Link href="/signup?role=seller" className="hover:opacity-80">{t("sell_on_bledify")}</Link>
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <LangSwitch className={overlay ? "border-white/30 bg-white/15 backdrop-blur [&_button:not([aria-pressed=true])]:text-white" : ""} />
          {user === undefined ? null : user ? (
            <Link href="/account" className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${overlay ? "bg-white/15 text-white backdrop-blur" : "bg-surface border border-line"}`}>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs text-white">
                {(displayName(user)[0] || "?").toUpperCase()}
              </span>
              <span className="hidden sm:inline">{displayName(user)}</span>
            </Link>
          ) : (
            <>
              <Link href={`/login?next=${next}`} className={`hidden rounded-full px-3 py-1.5 text-sm font-semibold sm:inline-block ${text}`}>{t("login")}</Link>
              <Link href={`/signup?next=${next}`} className="rounded-full bg-brand px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm">{t("signup")}</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
