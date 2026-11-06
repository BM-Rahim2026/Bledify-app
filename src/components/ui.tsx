"use client";
import { forwardRef } from "react";
import { useI18n } from "@/lib/i18n";
import { STATUS_COLOR } from "@/lib/orders";
import type { DictKey } from "@/lib/i18n/dict";

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "ok";
  size?: "sm" | "md";
};

export function Button({ variant = "primary", size = "md", className = "", ...p }: BtnProps) {
  const v = {
    primary: "bg-brand text-white hover:bg-brand-dark",
    secondary: "bg-surface text-ink border border-line hover:bg-sand",
    ghost: "text-brand hover:bg-brand-soft",
    danger: "bg-surface text-danger border border-line hover:bg-rose-50",
    ok: "bg-ok text-white hover:opacity-90",
  }[variant];
  const s = size === "sm" ? "min-h-9 px-3 text-sm" : "min-h-11 px-4";
  return (
    <button
      {...p}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition disabled:opacity-50 ${v} ${s} ${className}`}
    />
  );
}

export function Card({ className = "", ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={`rounded-2xl border border-line bg-surface p-4 ${className}`} />;
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && !error ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : null}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...p }, ref) {
    return <input ref={ref} {...p} className={`${inputCls} ${className}`} />;
  });

export function Select({ className = "", ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={`${inputCls} ${className}`} />;
}

export function Textarea({ className = "", ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={`${inputCls} ${className}`} />;
}

export function StatusPill({ status }: { status: string }) {
  const { t } = useI18n();
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold text-white ${STATUS_COLOR[status] ?? "bg-stone-500"}`}>
      {t(`st_${status}` as DictKey)}
    </span>
  );
}

export function RiskBadge() {
  const { t } = useI18n();
  return (
    <span title={t("risk_hint")} className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-danger">
      ⚠ {t("risk")}
    </span>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-label={title} className="w-full max-w-md rounded-t-3xl bg-surface p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Spinner() {
  return <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-16 text-center text-muted">{children}</div>;
}
