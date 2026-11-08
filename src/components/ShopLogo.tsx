/* eslint-disable @next/next/no-img-element */
import { CATEGORY_ICON_PATHS } from "@/components/Icon";

// Shop logo: the seller's uploaded image, or a generated badge in Bledify's style
// (arch, diamond, Amazigh rosette) with the shop's initials or a craft icon.

export type LogoConfig = { shape?: string; color?: string; content?: string };

export const LOGO_SHAPES = ["arch", "circle", "diamond", "seal"] as const;
export const LOGO_COLORS: Record<string, { bg: string; fg: string; accent: string }> = {
  green: { bg: "#1c4430", fg: "#f9f5f0", accent: "#ca826f" },
  terracotta: { bg: "#b8604b", fg: "#fbf3ec", accent: "#1c4430" },
  indigo: { bg: "#2b3a67", fg: "#f9f5f0", accent: "#e0a93b" },
  saffron: { bg: "#d99a2b", fg: "#3b2414", accent: "#fbf3ec" },
  olive: { bg: "#5b6b2e", fg: "#f9f5f0", accent: "#e0a93b" },
  plum: { bg: "#6b2d4f", fg: "#fbf3ec", accent: "#ca826f" },
  rose: { bg: "#ecc3b6", fg: "#1c4430", accent: "#1c4430" },
  sand: { bg: "#e9dbc4", fg: "#5a3b22", accent: "#b8604b" },
};

// 24×24 stroke icons, one per craft category
const ICONS: Record<string, string> = {
  food: CATEGORY_ICON_PATHS.food,
  fashion: CATEGORY_ICON_PATHS.fashion,
  crafts: CATEGORY_ICON_PATHS.crafts,
  home: CATEGORY_ICON_PATHS.home,
  occasions: CATEGORY_ICON_PATHS.occasions,
  beauty: CATEGORY_ICON_PATHS.beauty,
  jewelry: CATEGORY_ICON_PATHS.jewelry,
  gateaux: "M4 20h16M5 20v-6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6M5 16c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0M12 12V8M12 5.2v.1",
  cuisine: "M3 11h18M4 11a8 8 0 0 0 16 0M9 7.5c0-1.2 1.2-1.6 1.2-3M13.5 7.5c0-1.2 1.2-1.6 1.2-3",
  terroir: "M5 19C5 10.5 10.5 5 19 5c0 8.5-5.5 14-14 14zM5 19l8.5-8.5",
  couture: "M6 9a3 3 0 1 0 0-6a3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6a3 3 0 0 0 0 6zM8.1 8.1 20 20M8.1 15.9 20 4",
  enfants: "M12 3.5l2.5 5.2 5.7.7-4.2 3.9 1.1 5.6L12 16.2 6.9 18.9 8 13.3 3.8 9.4l5.7-.7z",
  artisanat: "M9 3h6M10 3v3C7.2 7 5 10 5 13.8a7 7 0 0 0 14 0C19 10 16.8 7 14 6V3M6 13h12",
  beaute: "M9.20 7.00a2.8 2.8 0 1 0 5.6 0a2.8 2.8 0 1 0-5.6 0M13.96 10.45a2.8 2.8 0 1 0 5.6 0a2.8 2.8 0 1 0-5.6 0M12.14 16.05a2.8 2.8 0 1 0 5.6 0a2.8 2.8 0 1 0-5.6 0M6.26 16.05a2.8 2.8 0 1 0 5.6 0a2.8 2.8 0 1 0-5.6 0M4.44 10.45a2.8 2.8 0 1 0 5.6 0a2.8 2.8 0 1 0-5.6 0M10.5 12a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0",
  bijoux: "M6.5 4h11l3.5 5-9 11L3 9zM3 9h18M9.5 4 12 9l2.5-5M12 9v11",
};

const STOP = /^(les?|la|l'|l’|dar|atelier|ferme|chez|maison|boutique|the|el|al)$/i;

export function shopInitials(name: string): string {
  const words = name.replace(/[«»"()]/g, " ").split(/\s+/).filter(Boolean);
  const main = words.filter((w) => !STOP.test(w) && !/^(de|du|des|d'|et|&)$/i.test(w));
  // Arabic letters join and read right-to-left: use one letter
  const arabic = /[\u0600-\u06FF]/.test(name);
  const pick = (main.length ? main : words).slice(0, arabic ? 1 : 2);
  return pick.map((w) => w.replace(/^(l'|d')/i, "")[0] ?? "").join("").toUpperCase();
}

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** Default config derived from the shop name, so every shop has a stable logo. */
export function defaultLogo(name: string): Required<LogoConfig> {
  const h = hash(name || "bledify");
  const colors = Object.keys(LOGO_COLORS);
  return { shape: LOGO_SHAPES[h % LOGO_SHAPES.length], color: colors[(h >> 3) % colors.length], content: "initials" };
}

function sealPath(points = 24, outer = 48, inner = 45.5) {
  let d = "";
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI * i) / points - Math.PI / 2;
    d += `${i ? "L" : "M"}${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`;
  }
  return d + "Z";
}
const SEAL = sealPath();

export function ShopLogo({ name, logo, logoUrl, category, size = 48, className = "" }: {
  name: string; logo?: LogoConfig | null; logoUrl?: string | null; category?: string | null;
  size?: number; className?: string;
}) {
  if (logoUrl) {
    return (
      <img src={logoUrl} alt={name} width={size} height={size}
        className={`shrink-0 rounded-2xl bg-white object-cover ${className}`} style={{ width: size, height: size }} />
    );
  }
  const base = defaultLogo(name);
  const cfg = { ...base, ...(logo ?? {}) };
  const pal = LOGO_COLORS[cfg.color] ?? LOGO_COLORS.green;
  const icon = cfg.content === "icon" && category ? ICONS[category] : undefined;
  const initials = shopInitials(name) || "B";
  const cy = cfg.shape === "arch" ? 60 : 52; // optical centre
  const accentY = cfg.shape === "arch" ? 30 : cfg.shape === "diamond" ? 22 : 20;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={name} className={`shrink-0 ${className}`}>
      {cfg.shape === "arch" ? (
        <>
          <path d="M8 97V46a42 42 0 0 1 84 0v51z" fill={pal.bg} />
          <path d="M18 97V48a32 32 0 0 1 64 0v49" fill="none" stroke={pal.fg} strokeOpacity=".35" strokeWidth="2" />
        </>
      ) : cfg.shape === "diamond" ? (
        <>
          <rect x="15" y="15" width="70" height="70" rx="14" transform="rotate(45 50 50)" fill={pal.bg} />
          <rect x="24" y="24" width="52" height="52" rx="9" transform="rotate(45 50 50)" fill="none" stroke={pal.fg} strokeOpacity=".35" strokeWidth="2" />
        </>
      ) : cfg.shape === "seal" ? (
        <>
          <path d={SEAL} fill={pal.bg} />
          <circle cx="50" cy="50" r="38" fill="none" stroke={pal.fg} strokeOpacity=".4" strokeWidth="1.6" strokeDasharray="1.5 3.5" />
        </>
      ) : (
        <>
          <circle cx="50" cy="50" r="48" fill={pal.bg} />
          <circle cx="50" cy="50" r="40" fill="none" stroke={pal.fg} strokeOpacity=".35" strokeWidth="2" />
        </>
      )}
      {/* the Bledify diamond */}
      <rect x={50 - 4.5} y={accentY - 4.5} width="9" height="9" rx="1.5" transform={`rotate(45 50 ${accentY})`} fill={pal.accent} />
      {icon ? (
        <g transform={`translate(${50 - 21} ${cy - 21}) scale(1.75)`}>
          <path d={icon} fill="none" stroke={pal.fg} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ) : (
        <text x="50" y={cy} dy=".35em" textAnchor="middle" fill={pal.fg}
          style={{ fontFamily: "var(--font-display), var(--font-naskh), serif" }}
          fontSize={/[\u0600-\u06FF]/.test(initials) ? 54 : initials.length > 1 ? 30 : 40}>
          {initials}
        </text>
      )}
    </svg>
  );
}
