import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Plus_Jakarta_Sans, Noto_Naskh_Arabic, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { Toaster } from "@/components/Toast";
import { getLang } from "@/lib/i18n/server";

const dmSerif = DM_Serif_Display({ weight: "400", subsets: ["latin"], variable: "--font-dm-serif" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });
const naskh = Noto_Naskh_Arabic({ subsets: ["arabic"], weight: ["400", "700"], variable: "--font-naskh" });
const notoArabic = Noto_Sans_Arabic({ subsets: ["arabic"], variable: "--font-noto-arabic" });

export const metadata: Metadata = {
  title: { default: "Bledify", template: "%s · Bledify" },
  description: "Boutique en ligne et gestion des commandes en paiement à la livraison pour les vendeurs algériens.",
  manifest: "/manifest.webmanifest",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://bledify.vercel.app"),
  openGraph: { siteName: "Bledify", images: ["/brand/icon-512.png"] },
  appleWebApp: { capable: true, title: "Bledify", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#1c4430", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  return (
    <html
      lang={lang}
      dir={lang === "ar" ? "rtl" : "ltr"}
      className={`${dmSerif.variable} ${jakarta.variable} ${naskh.variable} ${notoArabic.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <I18nProvider initial={lang}>{children}<Toaster /></I18nProvider>
      </body>
    </html>
  );
}
