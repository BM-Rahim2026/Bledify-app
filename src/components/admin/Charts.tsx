"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";

// Single-series charts for the admin dashboard. One hue (#3d8b5f, validated: lightness, chroma and
// contrast vs the white surface), thin bars with 4px rounded data-ends on the baseline, 2px gaps,
// recessive grid, a hover/focus tooltip on each bar and a table view (values reachable without hovering).
const BAR = "#3d8b5f";
const BAR_HOVER = "#56a578";

export function DailyBars({ title, data, format, dateLabel }: {
  title: string; data: { label: string; value: number }[]; format: (n: number) => string; dateLabel: (d: string) => string;
}) {
  const { t } = useI18n();
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const W = 640, H = 180, padL = 4, padB = 22, padT = 8;
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = (W - padL) / Math.max(1, data.length);
  const barW = Math.max(2, step - 2); // 2px surface gap between bars
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const h = hover !== null ? data[hover] : null;

  return (
    <div className="rounded-2xl border border-line bg-surface p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button type="button" onClick={() => setTable(!table)} className="text-xs font-semibold text-brand underline">{table ? t("adm_chart_view") : t("adm_table_view")}</button>
      </div>
      {table ? (
        <div className="max-h-56 overflow-y-auto">
          <table className="w-full text-sm"><tbody className="divide-y divide-line">
            {data.map((d) => <tr key={d.label}><td className="py-1 text-muted">{dateLabel(d.label)}</td><td className="py-1 text-end font-semibold">{format(d.value)}</td></tr>)}
          </tbody></table>
        </div>
      ) : (
        <div className="relative" dir="ltr">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" role="img" aria-label={title} preserveAspectRatio="none">
            {ticks.map((v) => <line key={v} x1={0} x2={W} y1={y(v)} y2={y(v)} stroke="currentColor" className="text-line" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
            {data.map((d, i) => {
              const top = y(d.value), x = padL + i * step, base = H - padB, hgt = Math.max(0, base - top);
              const r = Math.min(4, barW / 2, hgt);
              const path = hgt <= 0 ? "" : `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${base} Z`;
              return (
                <g key={d.label} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
                  <rect x={x - 1} y={padT} width={step} height={H - padT - padB} fill="transparent" tabIndex={0}
                    aria-label={`${dateLabel(d.label)} : ${format(d.value)}`} onFocus={() => setHover(i)} onBlur={() => setHover(null)} />
                  {path ? <path d={path} fill={hover === i ? BAR_HOVER : BAR} pointerEvents="none" /> : null}
                </g>
              );
            })}
            <line x1={0} x2={W} y1={H - padB} y2={H - padB} stroke="currentColor" className="text-muted" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="mt-1 flex justify-between text-[11px] text-muted">
            <span>{data[0] ? dateLabel(data[0].label) : ""}</span>
            <span>{data.length > 2 ? dateLabel(data[Math.floor(data.length / 2)].label) : ""}</span>
            <span>{data.length ? dateLabel(data[data.length - 1].label) : ""}</span>
          </div>
          <span className="pointer-events-none absolute end-1 top-0 text-[11px] text-muted">{format(max)}</span>
          {h ? (
            <div className="pointer-events-none absolute top-2 rounded-lg border border-line bg-surface px-2 py-1 text-xs shadow-md"
              style={{ insetInlineStart: `${Math.min(80, (hover! / Math.max(1, data.length - 1)) * 100)}%` }}>
              <p className="font-bold text-ink">{format(h.value)}</p>
              <p className="text-muted">{dateLabel(h.label)}</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Ranked horizontal bars with the value written at the end (direct labels, no legend needed). */
export function RankBars({ title, rows }: { title: string; rows: { label: string; value: number; display: string; sub?: string }[] }) {
  const { t } = useI18n();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="rounded-2xl border border-line bg-surface p-3 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {rows.length ? (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.label} title={`${r.label} : ${r.display}`}>
              <div className="flex justify-between gap-2 text-xs"><span className="truncate text-ink">{r.label}</span><span className="shrink-0 font-semibold text-ink">{r.display}</span></div>
              <div className="mt-0.5 h-2 rounded-full bg-sand"><div className="h-2 rounded-full" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: BAR }} /></div>
              {r.sub ? <p className="mt-0.5 text-[11px] text-muted">{r.sub}</p> : null}
            </li>
          ))}
        </ul>
      ) : <p className="text-xs text-muted">{t("adm_none")}</p>}
    </div>
  );
}
