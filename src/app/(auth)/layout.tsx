import Image from "next/image";
import Link from "next/link";
import { LangSwitch } from "@/lib/i18n";
import { HERO_IMAGE } from "@/lib/categories";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-2">
      <div className="relative hidden md:block">
        <Image src={HERO_IMAGE} alt="" fill priority sizes="50vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/10" />
        <Link href="/" className="absolute start-8 top-6 font-display text-3xl text-white">Bledify</Link>
      </div>
      <main className="mx-auto flex w-full max-w-md flex-col px-4 py-6">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="font-display text-2xl text-brand md:invisible">Bledify</Link>
          <LangSwitch />
        </header>
        {children}
      </main>
    </div>
  );
}
