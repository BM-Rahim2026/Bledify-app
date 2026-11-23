import Link from "next/link";
import { LangSwitch } from "@/lib/i18n";
import { Logo } from "@/components/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-2">
      <div className="relative hidden md:block">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-dark to-brand" />
        <Link href="/" aria-label="Bledify" className="absolute start-8 top-6"><Logo variant="white" height={40} /></Link>
      </div>
      <main className="mx-auto flex w-full max-w-md flex-col px-4 py-6">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" aria-label="Bledify" className="md:invisible"><Logo height={30} /></Link>
          <LangSwitch />
        </header>
        {children}
      </main>
    </div>
  );
}
