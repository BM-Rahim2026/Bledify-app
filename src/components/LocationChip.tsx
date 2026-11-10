"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n";
import { WILAYAS, wilayaLabel, wilayaValue } from "@/lib/wilayas";
import { locateByGps, useLocation } from "@/lib/location";
import { Icon } from "@/components/Icon";
import { Button, Select } from "@/components/ui";

const AUTO_KEY = "geo_auto_v1";
const name = (code: number, lang: "fr" | "ar") => {
  const w = WILAYAS.find((x) => x.code === code);
  return w ? wilayaLabel(wilayaValue(w), lang).replace(/^\d+ - /, "") : "";
};

/**
 * "📍 Oran ▾" in the header. On the first visit: a guess from the connection, then the browser asks once
 * for the position (GPS → nearest wilaya). The person can change it at any time.
 */
export function LocationChip({ className = "", mobile = false }: { className?: string; mobile?: boolean }) {
  const { t, lang } = useI18n();
  const { loc, set } = useLocation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [pick, setPick] = useState("");

  useEffect(() => {
    if (mobile !== window.matchMedia("(max-width: 1023px)").matches) return;
    let first = false;
    try { first = !localStorage.getItem(AUTO_KEY) && !document.cookie.includes("loc="); if (first) localStorage.setItem(AUTO_KEY, "1"); } catch { /* private mode */ }
    if (!first) return;
    let guessed = false;
    (async () => {
      try {
        const r = await fetch("/api/geo");
        const { code } = (await r.json()) as { code: number | null };
        if (code) { guessed = true; set({ code, source: "ip" }); }
      } catch { /* offline */ }
      try { set({ code: await locateByGps(), source: "gps" }); }
      catch { if (!guessed) setOpen(true); }
    })();
  }, [set, mobile]);

  async function useGps() {
    setBusy(true); setErr(false);
    try { set({ code: await locateByGps(), source: "gps" }); setOpen(false); }
    catch { setErr(true); }
    setBusy(false);
  }

  const label = loc ? name(loc.code, lang) : t("loc_choose");
  return (
    <>
      <button type="button" onClick={() => { setPick(loc ? String(loc.code) : ""); setErr(false); setOpen(true); }}
        aria-label={`${t("loc_title")} : ${label}`}
        className={`inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink shadow-sm hover:bg-sand ${className}`}>
        <Icon name="map" className="h-4 w-4 shrink-0 text-accent" />
        <span className="truncate">{loc ? <><span className="font-normal text-muted">{t("loc_near")} </span>{label}</> : label}</span>
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {open ? createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-labelledby="loc-title">
          <button type="button" aria-label={t("close")} className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md space-y-4 rounded-t-3xl bg-ivory p-5 pb-8 shadow-xl md:rounded-3xl md:pb-5">
            <div>
              <h2 id="loc-title" className="font-display text-2xl">{t("loc_title")}</h2>
              <p className="mt-1 text-sm text-muted">{t("loc_sub")}</p>
            </div>
            <Button className="w-full" disabled={busy} onClick={useGps}>
              <Icon name="map" className="h-5 w-5" /> {busy ? t("loc_locating") : t("loc_use_gps")}
            </Button>
            {err ? <p className="text-sm text-danger" role="alert">{t("loc_gps_error")}</p> : null}
            <div className="flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />{t("loc_or")}<span className="h-px flex-1 bg-line" /></div>
            <form className="flex gap-2" onSubmit={(e) => {
              e.preventDefault();
              if (!pick) return;
              set({ code: Number(pick), source: "manual" }); setOpen(false);
            }}>
              <Select aria-label={t("wilaya")} value={pick} onChange={(e) => setPick(e.target.value)} className="flex-1">
                <option value="">{t("choose_wilaya")}</option>
                {WILAYAS.map((w) => <option key={w.code} value={w.code}>{wilayaLabel(wilayaValue(w), lang)}</option>)}
              </Select>
              <Button type="submit" variant="secondary" disabled={!pick}>{t("loc_ok")}</Button>
            </form>
            {loc?.source === "ip" ? <p className="text-xs text-muted">{t("loc_ip_note")}</p> : null}
          </div>
        </div>, document.body,
      ) : null}
    </>
  );
}
