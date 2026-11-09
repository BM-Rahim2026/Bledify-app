import "server-only";
import { serverSecrets } from "@/lib/env";
import { translate, type DictKey, type Lang } from "@/lib/i18n/dict";
import { notificationText, type Notification } from "@/lib/notifications";
import { formatDZD } from "@/lib/format";
import { wilayaLabel } from "@/lib/wilayas";

type OrderMail = {
  to: string; lang: Lang; shopName: string; number: string; total: number; orderId: string;
  customer: string; phone: string; wilaya: string; items: { name: string; quantity: number }[]; siteUrl: string;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** New-order alert via Resend. Silently skipped when RESEND_API_KEY is not set. */
export async function sendNewOrderEmail(m: OrderMail): Promise<boolean> {
  const { resendKey } = serverSecrets();
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
  return sendMail([m.to], subject, html);
}

export const emailEnabled = () => Boolean(serverSecrets().resendKey);

async function sendMail(to: string[], subject: string, html: string): Promise<boolean> {
  const { resendKey, mailFrom } = serverSecrets();
  if (!resendKey || !to.length) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: mailFrom, to, subject, html }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

const button = (href: string, label: string) =>
  `<a href="${esc(href)}" style="display:inline-block;background:#1c4430;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none">${esc(label)}</a>`;

/** Daily summary of a person's unread notifications. */
export async function sendDigestEmail(d: { to: string; lang: Lang; siteUrl: string; items: Notification[] }): Promise<boolean> {
  const { to, lang, siteUrl, items } = d;
  const dir = lang === "ar" ? "rtl" : "ltr";
  const rows = items.slice(0, 15).map((n) => {
    const text = esc(notificationText(lang, n));
    return `<li style="margin:0 0 10px">${n.link ? `<a href="${esc(siteUrl + n.link)}" style="color:#1f2421">${text}</a>` : text}</li>`;
  }).join("");
  const more = items.length > 15 ? `<p style="color:#6b6f6c">+${items.length - 15}</p>` : "";
  const html = `<div dir="${dir}" style="font-family:sans-serif;font-size:15px;color:#1f2421;line-height:1.5">
    <h2 style="margin:0 0 12px;color:#1c4430">Bledify</h2>
    <p>${esc(translate(lang, "digest_intro", { n: items.length }))}</p>
    <ul style="padding-inline-start:18px">${rows}</ul>${more}
    <p>${button(`${siteUrl}/notifications`, translate(lang, "digest_open"))}</p>
    <p style="font-size:12px;color:#6b6f6c">${esc(translate(lang, "digest_footer"))}</p>
  </div>`;
  return sendMail([to], translate(lang, "digest_subject", { n: items.length }), html);
}

/** Morning summary for the team: what is waiting in the admin console. */
export async function sendTeamDigest(d: { to: string[]; siteUrl: string; counts: Record<string, number> }): Promise<boolean> {
  const labels: [string, string, DictKey][] = [
    ["applications", "/admin/shops", "adm_nav_shops"], ["review_queue", "/admin/review", "adm_nav_review"],
    ["reports", "/admin/reports", "adm_nav_reports"], ["refunds", "/admin/payments", "adm_nav_payments"],
    ["offers", "/admin/offers", "adm_nav_offers"],
  ];
  const total = labels.reduce((a, [k]) => a + (Number(d.counts[k]) || 0), 0);
  if (!total) return false;
  const rows = labels.filter(([k]) => Number(d.counts[k]) > 0)
    .map(([k, href, key]) => `<li><a href="${esc(d.siteUrl + href)}">${esc(translate("fr", key))}</a> : <b>${Number(d.counts[k])}</b></li>`).join("");
  const html = `<div style="font-family:sans-serif;font-size:15px;color:#1f2421">
    <h2 style="margin:0 0 12px;color:#1c4430">${esc(translate("fr", "team_digest_title"))}</h2><ul>${rows}</ul>
    <p>${button(`${d.siteUrl}/admin`, translate("fr", "admin_title"))}</p></div>`;
  return sendMail(d.to, translate("fr", "team_digest_subject", { n: total }), html);
}
