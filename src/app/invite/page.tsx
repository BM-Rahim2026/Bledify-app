import type { Metadata } from "next";
import Image from "next/image";
import { HERO_IMAGE } from "@/lib/categories";
import { InviteGate } from "@/components/InviteGate";

export const metadata: Metadata = {
  title: "Bledify — sur invitation",
  description: "Le marché du fait main algérien. Accès sur invitation.",
  robots: { index: false, follow: false },
};

/** Shown to everyone without an invitation while Bledify is invite-only. */
export default async function InvitePage({ searchParams }: PageProps<"/invite">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  return (
    <div className="relative min-h-dvh bg-brand">
      <Image src={HERO_IMAGE} alt="" fill priority sizes="100vw" className="object-cover opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-b from-brand/40 via-brand/70 to-brand" />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
        <InviteGate code={one(sp.code)} error={one(sp.error)} reason={one(sp.reason)} next={one(sp.next)} />
      </div>
    </div>
  );
}
