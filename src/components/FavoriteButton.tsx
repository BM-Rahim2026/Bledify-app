"use client";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { toggleFavorite, useFavorite } from "@/lib/favorites";
import { Icon } from "@/components/Icon";

/** ♥ button for a product or a shop. Signed-out users are sent to log in first. */
export function FavoriteButton({ kind, id, className = "", size = "md" }: {
  kind: "product" | "shop"; id: string; className?: string; size?: "sm" | "md";
}) {
  const { t } = useI18n();
  const on = useFavorite(kind, id);
  const router = useRouter();
  const path = usePathname();
  const box = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? t("fav_remove") : t("fav_add")}
      onClick={async (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!(await toggleFavorite(kind, id))) router.push(`/login?next=${encodeURIComponent(path)}`);
      }}
      className={`inline-flex ${box} shrink-0 items-center justify-center rounded-full bg-white/95 shadow-sm ring-1 ring-black/5 transition active:scale-90 ${on ? "text-rose-600" : "text-ink"} ${className}`}
    >
      <Icon name="heart" className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} fill={on ? "currentColor" : "none"} />
    </button>
  );
}
