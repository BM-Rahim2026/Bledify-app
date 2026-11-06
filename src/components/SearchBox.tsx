"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

export function SearchBox({ large = false, initial = "", category }: { large?: boolean; initial?: string; category?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState(initial);
  return (
    <form role="search" onSubmit={(e) => {
      e.preventDefault();
      const p = new URLSearchParams();
      if (q.trim()) p.set("q", q.trim());
      if (category) p.set("category", category);
      router.push(`/explore${p.size ? `?${p}` : ""}`);
    }} className={`flex items-center gap-2 rounded-2xl bg-surface p-1.5 ${large ? "shadow-xl" : "border border-line"}`}>
      <svg viewBox="0 0 24 24" className="ms-2 h-5 w-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search_placeholder")} aria-label={t("search")}
        className={`min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted ${large ? "py-2.5" : "py-1.5"}`} />
      <button type="submit" aria-label={t("search")} className={`shrink-0 rounded-xl bg-brand font-semibold text-white ${large ? "px-4 py-2.5 sm:px-5" : "px-3 py-1.5 text-sm sm:px-4"}`}>
        <span className="hidden sm:inline">{t("search")}</span>
        <svg viewBox="0 0 24 24" className="h-5 w-5 sm:hidden rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </button>
    </form>
  );
}
