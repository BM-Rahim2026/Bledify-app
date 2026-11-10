"use client";
import { useEffect, useState } from "react";

type T = { id: number; text: string; tone: "ok" | "error" };
const EVENT = "bledify:toast";
let seq = 0;

/** Show a confirmation pop-up (top of the screen, 3.5 s). Usable from any client component. */
export function toast(text: string, tone: T["tone"] = "ok") {
  window.dispatchEvent(new CustomEvent<T>(EVENT, { detail: { id: ++seq, text, tone } }));
}

/** Mounted once in the root layout. */
export function Toaster() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const t = (e as CustomEvent<T>).detail;
      setItems((l) => [...l.slice(-2), t]);
      setTimeout(() => setItems((l) => l.filter((x) => x.id !== t.id)), 3500);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div key={t.id} role={t.tone === "error" ? "alert" : "status"}
          className={`toast-in pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl px-4 py-3.5 text-[15px] font-semibold text-white shadow-2xl ring-1 ring-black/5 ${t.tone === "ok" ? "bg-brand" : "bg-danger"}`}>
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${t.tone === "ok" ? "bg-white text-brand" : "bg-white text-danger"}`}>
            {t.tone === "ok"
              ? <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              : <span aria-hidden>!</span>}
          </span>
          <span className="min-w-0 flex-1">{t.text}</span>
        </div>
      ))}
    </div>
  );
}
