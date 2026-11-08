"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Icon } from "@/components/Icon";

/** Calls an admin RPC and keeps its result; `reload` calls it again. */
export function useAdminRpc<T>(fn: string, args: Record<string, unknown>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const key = JSON.stringify(args);
  const reload = useCallback(async () => {
    const { data: d, error: e } = await supabase().rpc(fn, JSON.parse(key));
    setError(Boolean(e));
    setData((d ?? null) as T | null);
  }, [fn, key]);
  useEffect(() => { queueMicrotask(() => void reload()); }, [reload]);
  return { data, error, reload };
}

/** Runs an admin action, then reloads. Returns whether it worked. */
export async function adminCall(fn: string, args: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase().rpc(fn, args);
  return !error;
}

export function Stat({ label, value, sub, href }: { label: string; value: React.ReactNode; sub?: React.ReactNode; href?: string }) {
  const body = (
    <div className="h-full rounded-2xl border border-line bg-surface p-3 shadow-sm">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1 whitespace-nowrap text-xl font-bold text-ink sm:text-2xl">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Chips<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {options.map((o) => (
        <button key={o.key || "all"} type="button" onClick={() => onChange(o.key)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${value === o.key ? "bg-ink text-white" : "border border-line bg-surface"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Search box that reports its value after a short pause. */
export function SearchInput({ initial = "", onSearch }: { initial?: string; onSearch: (q: string) => void }) {
  const { t } = useI18n();
  const [v, setV] = useState(initial);
  useEffect(() => { const id = setTimeout(() => onSearch(v.trim()), 350); return () => clearTimeout(id); }, [v, onSearch]);
  return (
    <label className="relative block">
      <Icon name="search" className="pointer-events-none absolute start-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted" />
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={t("adm_search")} dir="auto"
        className="w-full rounded-xl border border-line bg-surface py-2.5 ps-10 pe-3 text-sm" />
    </label>
  );
}

export function Pill({ tone = "muted", children }: { tone?: "ok" | "warn" | "danger" | "brand" | "muted"; children: React.ReactNode }) {
  const c = { ok: "bg-emerald-50 text-ok", warn: "bg-amber-50 text-amber-900", danger: "bg-rose-50 text-danger", brand: "bg-brand-soft text-brand", muted: "bg-stone-100 text-muted" }[tone];
  return <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${c}`}>{children}</span>;
}

export function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2"><h2 className="font-display text-xl">{title}</h2>{action}</div>
      {children}
    </section>
  );
}

export function Empty({ text }: { text?: string }) {
  const { t } = useI18n();
  return <p className="rounded-2xl border border-dashed border-line py-10 text-center text-sm text-muted">{text ?? t("adm_none")}</p>;
}

// ---------------------------------------------------------------- tables
export type Col<T> = {
  key: string; label: string; render: (row: T) => React.ReactNode;
  sort?: (row: T) => string | number; csv?: (row: T) => string | number; className?: string;
};

/** Sortable, paginated table with CSV export (Sharetribe-style "download this page"). */
export function DataTable<T>({ rows, cols, rowKey, href, pageSize = 25, filename = "export", selectable, selected, onSelect }: {
  rows: T[]; cols: Col<T>[]; rowKey: (r: T) => string; href?: (r: T) => string; pageSize?: number; filename?: string;
  selectable?: boolean; selected?: Set<string>; onSelect?: (s: Set<string>) => void;
}) {
  const { t } = useI18n();
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [desc, setDesc] = useState(true);
  const [page, setPage] = useState(0);
  const col = cols.find((c) => c.key === sortKey);
  const sorted = col?.sort ? [...rows].sort((a, b) => {
    const x = col.sort!(a), y = col.sort!(b);
    return (x < y ? -1 : x > y ? 1 : 0) * (desc ? -1 : 1);
  }) : rows;
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const p = Math.min(page, pages - 1);
  const shown = sorted.slice(p * pageSize, (p + 1) * pageSize);

  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = cols.filter((c) => c.csv).map((c) => esc(c.label)).join(";");
    const body = sorted.map((r) => cols.filter((c) => c.csv).map((c) => esc(c.csv!(r))).join(";")).join("\n");
    const blob = new Blob(["﻿" + head + "\n" + body], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(a.href);
  }
  const toggle = (id: string) => {
    if (!onSelect || !selected) return;
    const n = new Set(selected); if (n.has(id)) n.delete(id); else n.add(id); onSelect(n);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>{t("adm_rows", { n: rows.length })}</span>
        {cols.some((c) => c.csv) ? <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 font-semibold text-ink"><Icon name="arrow" className="h-3.5 w-3.5 rotate-90" />CSV</button> : null}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-sand/60 text-xs text-muted">
            <tr>
              {selectable ? (
                <th className="w-8 px-3 py-2"><input type="checkbox" aria-label="all" className="h-4 w-4 accent-brand"
                  checked={shown.length > 0 && shown.every((r) => selected?.has(rowKey(r)))}
                  onChange={(e) => onSelect?.(new Set(e.target.checked ? [...(selected ?? []), ...shown.map(rowKey)] : [...(selected ?? [])].filter((x) => !shown.some((r) => rowKey(r) === x))))} /></th>
              ) : null}
              {cols.map((c) => (
                <th key={c.key} className={`whitespace-nowrap px-3 py-2 text-start font-semibold ${c.className ?? ""}`}>
                  {c.sort ? (
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => { if (sortKey === c.key) setDesc(!desc); else { setSortKey(c.key); setDesc(true); } }}>
                      {c.label}<span aria-hidden>{sortKey === c.key ? (desc ? "▾" : "▴") : "↕"}</span>
                    </button>
                  ) : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((r) => (
              <tr key={rowKey(r)} className="hover:bg-ivory">
                {selectable ? <td className="px-3 py-2"><input type="checkbox" aria-label="select" className="h-4 w-4 accent-brand" checked={selected?.has(rowKey(r)) ?? false} onChange={() => toggle(rowKey(r))} /></td> : null}
                {cols.map((c, i) => (
                  <td key={c.key} className={`px-3 py-2 align-middle ${c.className ?? ""}`}>
                    {i === 0 && href ? <Link href={href(r)} className="font-semibold text-ink hover:text-brand">{c.render(r)}</Link> : c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
            {shown.length === 0 ? <tr><td colSpan={cols.length + (selectable ? 1 : 0)} className="px-3 py-10 text-center text-muted">{t("adm_none")}</td></tr> : null}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button type="button" disabled={p === 0} onClick={() => setPage(p - 1)} className="rounded-lg border border-line bg-surface px-3 py-1 disabled:opacity-40">‹</button>
          <span className="text-muted">{p + 1} / {pages}</span>
          <button type="button" disabled={p >= pages - 1} onClick={() => setPage(p + 1)} className="rounded-lg border border-line bg-surface px-3 py-1 disabled:opacity-40">›</button>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- internal notes + history for one record
export function NotesAndLog({ type, id, logType }: { type: "shop" | "customer" | "order"; id: string; logType?: string }) {
  const { t, lang } = useI18n();
  const { data: notes, reload } = useAdminRpc<{ id: number; admin_email: string; body: string; created_at: string }[]>("admin_notes", { p_type: type, p_target: id });
  const { data: log } = useAdminRpc<AuditRow[]>("admin_audit_log", { p_type: logType ?? "", p_target: logType ? id : "__none__", p_limit: 50 });
  const [body, setBody] = useState("");
  const fmt = (d: string) => new Intl.DateTimeFormat(lang === "ar" ? "ar-DZ-u-nu-latn" : "fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Algiers" }).format(new Date(d));
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 [&>*]:min-w-0">
      <Section title={t("adm_notes")}>
        <div className="space-y-2 rounded-2xl border border-line bg-surface p-3">
          <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (body.trim() && await adminCall("admin_add_note", { p_type: type, p_target: id, p_body: body })) { setBody(""); await reload(); } }}>
            <input value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder={t("adm_note_ph")} dir="auto" className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm" />
            <button type="submit" className="shrink-0 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white">{t("adm_add")}</button>
          </form>
          {(notes ?? []).map((n) => (
            <div key={n.id} className="rounded-xl bg-ivory p-2 text-sm">
              <p className="whitespace-pre-line" dir="auto">{n.body}</p>
              <p className="mt-1 text-xs text-muted" dir="ltr">{n.admin_email} · {fmt(n.created_at)}</p>
            </div>
          ))}
          {notes && notes.length === 0 ? <p className="text-xs text-muted">{t("adm_no_notes")}</p> : null}
        </div>
      </Section>
      {logType ? (
        <Section title={t("adm_history_team")}>
          <div className="rounded-2xl border border-line bg-surface p-3"><AuditList rows={log ?? []} /></div>
        </Section>
      ) : null}
    </div>
  );
}

export type AuditRow = { id: number; admin_email: string; action: string; target_type: string; target_id: string; details: Record<string, unknown>; created_at: string };

export function AuditList({ rows, showTarget = false }: { rows: AuditRow[]; showTarget?: boolean }) {
  const { t, lang } = useI18n();
  const fmt = (d: string) => new Intl.DateTimeFormat(lang === "ar" ? "ar-DZ-u-nu-latn" : "fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Algiers" }).format(new Date(d));
  const summary = (r: AuditRow) => Object.entries(r.details ?? {}).map(([k, v]) => {
    const ch = v as { from?: unknown; to?: unknown } | unknown;
    return ch && typeof ch === "object" && "to" in (ch as object) ? `${k}: ${JSON.stringify((ch as { from: unknown }).from ?? "")} → ${JSON.stringify((ch as { to: unknown }).to ?? "")}` : `${k}: ${JSON.stringify(v)}`;
  }).join(" · ");
  if (!rows.length) return <p className="text-xs text-muted">{t("adm_none")}</p>;
  return (
    <ul className="divide-y divide-line text-sm">
      {rows.map((r) => (
        <li key={r.id} className="py-2">
          <p className="flex flex-wrap items-center gap-x-2"><b>{r.action}</b>{showTarget ? <span className="text-muted">{r.target_type} · <span dir="ltr" className="font-mono text-xs">{r.target_id.slice(0, 13)}</span></span> : null}</p>
          <p className="break-all text-xs text-muted" dir="ltr">{summary(r)}</p>
          <p className="text-xs text-muted" dir="ltr">{r.admin_email} · {fmt(r.created_at)}</p>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- KPI with comparison
export function Kpi({ label, value, prev, format }: { label: string; value: number; prev: number; format: (n: number) => string }) {
  const { t } = useI18n();
  const delta = prev ? Math.round(((value - prev) / prev) * 100) : null;
  return (
    <div className="rounded-2xl border border-line bg-surface p-3 shadow-sm">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1 whitespace-nowrap text-xl font-bold text-ink sm:text-2xl">{format(value)}</p>
      <p className="mt-0.5 text-xs text-muted">
        {delta === null ? t("adm_prev_none") : <><span className={delta >= 0 ? "text-ok" : "text-danger"}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} %</span> {t("adm_vs_prev")}</>}
      </p>
    </div>
  );
}
