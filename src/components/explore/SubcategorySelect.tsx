"use client";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Icon } from "@/components/Icon";

/** Dropdown of the category's subcategories (with product counts); choosing one reloads the page. */
export function SubcategorySelect({ options, value, hrefFor }: {
  options: { key: string; label: string; count: number }[]; value: string; hrefFor: Record<string, string>;
}) {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <label className="relative mt-3 block">
      <span className="sr-only">{t("subcategory")}</span>
      <Icon name="grid" className="pointer-events-none absolute start-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-brand" />
      <select value={value} onChange={(e) => router.push(hrefFor[e.target.value] ?? hrefFor[""])}
        className="w-full appearance-none rounded-xl border border-line bg-surface py-3 ps-10 pe-10 text-sm font-semibold text-ink">
        <option value="">{t("sub_all")}</option>
        {options.map((o) => (
          <option key={o.key} value={o.key}>{o.label}{o.count ? ` (${o.count})` : ""}</option>
        ))}
      </select>
      <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted">▾</span>
    </label>
  );
}
