import "server-only";
import { serverSecrets } from "@/lib/env";
import { translate, type Lang } from "@/lib/i18n/dict";
import { formatDZD } from "@/lib/format";
import { wilayaLabel } from "@/lib/wilayas";

type OrderMail = {
  to: string; lang: Lang; shopName: string; number: string; total: number; orderId: string;
  customer: string; phone: string; wilaya: string; items: { name: string; quantity: number }[]; siteUrl: string;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** New-order alert via Resend. Silently skipped when RESEND_API_KEY is not set. */
export async function sendNewOrderEmail(m: OrderMail): Promise<boolean> {
  const { resendKey, mailFrom } = serverSecrets();
  if (!resendKey || !m.to) return false;
  const subject = translate(m.lang, "email_subject", { number: m.number, total: formatDZD(m.total) });
  const dir = m.lang === "ar" ? "rtl" : "ltr";
  const html = `<div dir="${dir}" style="font-family:sans-serif;font-size:15px;color:#1f2421">
    <h2 style="margin:0 0 8px">${esc(m.shopName)} — ${esc(m.number)}</h2>
    <p><b>${esc(m.customer)}</b> · ${esc(m.phone)} · ${esc(wilayaLabel(m.wilaya, m.lang))}</p>
    <p>${m.items.map((i) => `${esc(i.name)} ×${i.quantity}`).join("<br>")}</p>
    <p style="font-size:18px"><b>${esc(formatDZD(m.total))}</b></p>
    <p><a href="${esc(m.siteUrl)}/seller/orders/${esc(m.orderId)}" style="background:#1c4430;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none">${esc(translate(m.lang, "see_orders"))}</a></p>
  </div>`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: mailFrom, to: [m.to], subject, html }),
    });
    return r.ok;
  } catch {
    return false;
  }
}
