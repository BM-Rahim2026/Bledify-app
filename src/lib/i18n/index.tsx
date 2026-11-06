"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { translate, type DictKey, type Lang } from "./dict";
import { formatDZD } from "@/lib/format";

type Ctx = {
  lang: Lang;
  dir: "ltr" | "rtl";
  t: (key: DictKey, vars?: Record<string, string | number>) => string;
  setLang: (l: Lang) => void;
  formatDZD: typeof formatDZD;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ initial, children }: { initial: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);
  const router = useRouter();

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = l;
    document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
    router.refresh();
  }, [router]);

  const value = useMemo<Ctx>(() => ({
    lang,
    dir: lang === "ar" ? "rtl" : "ltr",
    t: (key, vars) => translate(lang, key, vars),
    setLang,
    formatDZD,
  }), [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const c = useContext(I18nContext);
  if (!c) throw new Error("useI18n outside I18nProvider");
  return c;
}

export function LangSwitch({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <div className={`inline-flex rounded-full border border-line bg-surface p-0.5 text-sm ${className}`}>
      {(["fr", "ar"] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          className={`rounded-full px-3 py-1 font-semibold ${lang === l ? "bg-brand text-white" : "text-muted"}`}
          aria-pressed={lang === l}
        >
          {l === "fr" ? "FR" : "عربي"}
        </button>
      ))}
    </div>
  );
}
