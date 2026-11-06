// Formatting helpers shared by server and client code.

/** 1100 → "1 100 DA" (non-breaking spaces). */
export function formatDZD(n: number | null | undefined): string {
  const v = Math.round(Number(n) || 0);
  const s = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${v < 0 ? "-" : ""}${s} DA`;
}

/** Algerian mobile number → "0XXXXXXXXX", or null when invalid. */
export function normalizePhone(p: string): string | null {
  let d = (p || "").replace(/[^0-9+]/g, "");
  if (d.startsWith("+213")) d = "0" + d.slice(4);
  else if (d.startsWith("00213")) d = "0" + d.slice(5);
  else if (d.startsWith("213") && d.length === 12) d = "0" + d.slice(3);
  else if (d.length === 9 && /^[5-7]/.test(d)) d = "0" + d;
  return /^0[5-7]\d{8}$/.test(d) ? d : null;
}

/** "0661234567" → "0661 23 45 67" */
export function prettyPhone(p: string): string {
  const d = normalizePhone(p);
  if (!d) return p;
  return `${d.slice(0, 4)} ${d.slice(4, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)}`;
}

/** wa.me number: "0661234567" → "213661234567" */
export function waNumber(p: string): string {
  const d = normalizePhone(p);
  return d ? "213" + d.slice(1) : (p || "").replace(/\D/g, "");
}

const TZ = "Africa/Algiers";

export function formatDateTime(iso: string, lang: "fr" | "ar"): string {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-DZ-u-nu-latn" : "fr-FR", {
    timeZone: TZ, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDate(iso: string, lang: "fr" | "ar"): string {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-DZ-u-nu-latn" : "fr-FR", {
    timeZone: TZ, day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(iso));
}

export function slugify(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}
