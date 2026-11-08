"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { WILAYAS, wilayaLabel, wilayaValue } from "@/lib/wilayas";
import { ZONES, ZONE_OF, zoneKey, type DeliveryZones, type Zone, type ZoneRate } from "@/lib/delivery";

/** Seller's delivery prices: home / desk / delay for each zone, or "no delivery". */
export function ZoneEditor({ value, onChange }: { value: DeliveryZones; onChange: (z: DeliveryZones) => void }) {
  const { t, lang } = useI18n();
  const [showList, setShowList] = useState(false);
  const set = (z: Zone, patch: Partial<ZoneRate>) => {
    const cur = value[z] ?? { home: 600, desk: 400 };
    onChange({ ...value, [z]: { ...cur, ...patch } });
  };
  const num = (s: string) => Math.max(0, Math.min(20000, Math.round(Number(s) || 0)));
  const days = (s: string) => (s === "" ? undefined : Math.max(0, Math.min(30, Math.round(Number(s) || 0))));

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{t("delivery_by_zone")}</legend>
      <p className="text-xs text-muted">{t("delivery_by_zone_hint")}</p>
      {ZONES.map((z) => {
        const r = value[z] ?? { home: 600, desk: 400 };
        const off = Boolean(r.off);
        return (
          <div key={z} className={`rounded-xl border p-3 ${off ? "border-line bg-stone-50" : "border-line bg-surface"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{t(zoneKey(z))}</span>
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <input type="checkbox" className="h-4 w-4 accent-brand" checked={off} onChange={(e) => set(z, { off: e.target.checked || undefined })} />
                {t("zone_off")}
              </label>
            </div>
            {off ? null : (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="text-xs text-muted">{t("home")}
                  <input type="number" inputMode="numeric" min={0} value={r.home} onChange={(e) => set(z, { home: num(e.target.value) })}
                    className="mt-0.5 w-full rounded-lg border border-line bg-surface px-2 py-2 text-sm text-ink" />
                </label>
                <label className="text-xs text-muted">{t("desk")}
                  <input type="number" inputMode="numeric" min={0} value={r.desk} onChange={(e) => set(z, { desk: num(e.target.value) })}
                    className="mt-0.5 w-full rounded-lg border border-line bg-surface px-2 py-2 text-sm text-ink" />
                </label>
                <label className="text-xs text-muted">{t("days_label")}
                  <span className="mt-0.5 flex items-center gap-1">
                    <input type="number" inputMode="numeric" min={0} max={30} aria-label="min" value={r.days_min ?? ""} onChange={(e) => set(z, { days_min: days(e.target.value) })}
                      className="w-full min-w-0 rounded-lg border border-line bg-surface px-1.5 py-2 text-center text-sm text-ink" />
                    –
                    <input type="number" inputMode="numeric" min={0} max={30} aria-label="max" value={r.days_max ?? ""} onChange={(e) => set(z, { days_max: days(e.target.value) })}
                      className="w-full min-w-0 rounded-lg border border-line bg-surface px-1.5 py-2 text-center text-sm text-ink" />
                  </span>
                </label>
              </div>
            )}
          </div>
        );
      })}
      <button type="button" className="text-sm font-semibold text-brand" onClick={() => setShowList((x) => !x)}>{t("zone_wilayas")} {showList ? "▴" : "▾"}</button>
      {showList ? (
        <div className="space-y-2 rounded-xl bg-sand p-3 text-xs">
          {ZONES.filter((z) => z !== "local").map((z) => (
            <p key={z}><b>{t(zoneKey(z))} :</b> {WILAYAS.filter((w) => (ZONE_OF[w.code] ?? "nord") === z).map((w) => wilayaLabel(wilayaValue(w), lang).replace(/^\d+ - /, "")).join(", ")}</p>
          ))}
        </div>
      ) : null}
    </fieldset>
  );
}
