import type { Metadata } from "next";
import { InviteGate } from "@/components/InviteGate";

export const metadata: Metadata = {
  title: { absolute: "Bledify" },
  description: "Accès sur invitation.",
  openGraph: { title: "Bledify", description: "Accès sur invitation." },
  robots: { index: false, follow: false },
};

/** Shown to everyone without an invitation while Bledify is invite-only. */
export default async function InvitePage({ searchParams }: PageProps<"/invite">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  return (
    <div className="relative min-h-dvh bg-brand">
      <div className="absolute inset-0 bg-gradient-to-b from-brand-dark to-brand" />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
        <InviteGate code={one(sp.code)} error={one(sp.error)} reason={one(sp.reason)} next={one(sp.next)} />
      </div>
    </div>
  );
}
