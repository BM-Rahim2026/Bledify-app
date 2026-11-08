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
  return <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${c}`}>{children}</span>;
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
