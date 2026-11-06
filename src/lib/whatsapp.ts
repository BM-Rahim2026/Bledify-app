import { translate, type Lang } from "@/lib/i18n/dict";
import { formatDZD, waNumber } from "@/lib/format";
import { wilayaLabel } from "@/lib/wilayas";
import type { Order } from "@/lib/orders";

export function whatsappLink(o: Order, shopName: string, lang: Lang): string {
  const items = o.items.map((i) => `• ${i.name} ×${i.quantity} — ${formatDZD(i.unit_price_dzd * i.quantity)}`).join("\n");
  const where = [o.address, o.commune, wilayaLabel(o.wilaya, lang)].filter(Boolean).join(", ");
  const delivery = `${translate(lang, o.delivery_type === "desk" ? "desk" : "home")} ${where}`;
  const text = translate(lang, "wa_msg", {
    name: o.customer_name, shop: shopName, number: o.number, items,
    total: formatDZD(o.total_dzd), delivery,
  });
  return `https://wa.me/${waNumber(o.phone)}?text=${encodeURIComponent(text)}`;
}
