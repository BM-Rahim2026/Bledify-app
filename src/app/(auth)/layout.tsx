import Link from "next/link";
import { LangSwitch } from "@/lib/i18n";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-6">
      <header className="mb-10 flex items-center justify-between">
        <Link href="/" className="font-display text-2xl text-brand">Bledify</Link>
        <LangSwitch />
      </header>
      {children}
    </main>
  );
}
