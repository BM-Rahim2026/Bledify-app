"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { aiPost } from "@/lib/ai-client";
import { shopUrl, useSeller } from "@/lib/seller";
import { Button, Field, Modal, Select, Spinner, Textarea } from "@/components/ui";
import type { DictKey } from "@/lib/i18n/dict";

const LANGS = ["fr", "ar", "darija_ar", "darija_lat"] as const;
const PLATFORMS = ["facebook", "instagram", "whatsapp"] as const;

/** Writes a ready-to-paste Facebook / Instagram / WhatsApp post for one product. */
export function PostGenerator({ productId, open, onClose }: { productId: string; open: boolean; onClose: () => void }) {
  const { t, lang: uiLang } = useI18n();
  const { shop } = useSeller();
  const [lang, setLang] = useState<string>(uiLang);
  const [platform, setPlatform] = useState<string>("facebook");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<DictKey | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setBusy(true); setErr(null);
    const { data, error } = await aiPost<{ text: string }>("/api/ai/post", { productId, lang, platform, shopUrl: shopUrl(shop.slug) });
    setBusy(false);
    if (error || !data) { setErr(error ?? "error"); return; }
    setText(data.text);
  }

  return (
    <Modal open={open} onClose={onClose} title={`📣 ${t("ai_post_title")}`}>
      <div className="max-h-[75dvh] space-y-3 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2">
          <Field label={t("ai_language")}>
            <Select value={lang} onChange={(e) => setLang(e.target.value)}>
              {LANGS.map((l) => <option key={l} value={l}>{t(`lang_${l}` as DictKey)}</option>)}
            </Select>
          </Field>
          <Field label={t("platform")}>
            <Select value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p === "whatsapp" ? "WhatsApp" : p[0].toUpperCase() + p.slice(1)}</option>)}
            </Select>
          </Field>
        </div>
        <Button type="button" className="w-full" onClick={generate} disabled={busy}>
          {busy ? <><Spinner /> {t("ai_working")}</> : <>✨ {text ? t("ai_regenerate") : t("ai_generate")}</>}
        </Button>
        {err ? <p className="text-sm text-danger" role="alert">{t(err)}</p> : null}
        {text ? (
          <>
            <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} dir="auto" />
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" onClick={async () => {
                await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500);
              }}>{copied ? t("copied") : t("copy_text")}</Button>
              <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#25D366] px-3 text-center font-semibold leading-tight text-white">
                {t("share_whatsapp")}
              </a>
            </div>
            <p className="text-xs text-muted">{t("ai_disclaimer")}</p>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
