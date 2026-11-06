"use client";
import Link from "next/link";

export function PageHeader({ title, back, action }: { title: string; back?: string; action?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-sand/95 px-4 py-3 backdrop-blur no-print">
      {back ? (
        <Link href={back} aria-label="back" className="-ms-2 rounded-full p-2 text-ink hover:bg-surface">
          <svg viewBox="0 0 24 24" className="h-5 w-5 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 18l-6-6 6-6" /></svg>
        </Link>
      ) : null}
      <h1 className="min-w-0 flex-1 truncate font-display text-2xl">{title}</h1>
      {action}
    </header>
  );
}
