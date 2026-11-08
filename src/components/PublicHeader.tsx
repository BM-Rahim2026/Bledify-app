"use client";
import Link from "next/link";
import { useI18n, LangSwitch } from "@/lib/i18n";
import { useCartCount } from "@/lib/cart";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";

/** Ivory top bar: search · logo + tagline (centre) · language, favourites, cart. */
export function PublicHeader({ tagline = false }: { tagline?: boolean; overlay?: boolean }) {
  const { t } = useI18n();
  const count = useCartCount();
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-ivory/95 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2">
        <div className="flex items-center gap-1">
          <Link href="/explore" aria-label={t("search")} className="rounded-full p-2 text-ink hover:bg-sand"><Icon name="search" className="h-6 w-6" /></Link>
          <nav className="ms-2 hidden gap-4 text-sm font-semibold md:flex">
            <Link href="/categories" className="hover:text-brand">{t("nav_categories")}</Link>
            <Link href="/track" className="hover:text-brand">{t("track_order")}</Link>
            <Link href="/signup?role=seller" className="hover:text-brand">{t("sell_on_bledify")}</Link>
          </nav>
        </div>
        <Link href="/" aria-label="Bledify" className="flex flex-col items-center">
          <Logo height={28} className="h-[26px] w-auto min-[360px]:h-[28px]" />
        </Link>
        <div className="flex items-center justify-end gap-0.5">
          <LangSwitch className="hidden min-[400px]:inline-flex [&_button]:px-2" />
          <Link href="/favorites" aria-label={t("favorites")} className="hidden rounded-full p-2 text-ink hover:bg-sand min-[360px]:block"><Icon name="heart" className="h-6 w-6" /></Link>
          <Link href="/cart" aria-label={t("cart_title")} className="relative rounded-full p-2 text-ink hover:bg-sand">
            <Icon name="cart" className="h-6 w-6" />
            {count ? <span className="absolute end-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">{count}</span> : null}
          </Link>
        </div>
      </div>
      {tagline ? <p className="-mt-1 pb-1.5 text-center text-[11px] font-semibold text-gold">{t("tagline_short")}</p> : null}
    </header>
  );
}
