import { NextResponse, type NextRequest } from "next/server";
import { AI_BETAS, AI_MODEL, BLEDIFY_CONTEXT, LANG_NAME, aiErrorResponse, aiGate } from "@/lib/server/ai";
import { formatDZD } from "@/lib/format";

const PLATFORM: Record<string, string> = {
  facebook: "a Facebook post for a selling group or page (3-6 short lines, a few emojis, 3-5 hashtags at the end)",
  instagram: "an Instagram caption (catchy first line, short lines, emojis, 8-12 relevant hashtags at the end)",
  whatsapp: "a WhatsApp status / broadcast message (very short, 2-4 lines, no hashtags)",
};

// Writes a social media post for one of the seller's products.
export async function POST(req: NextRequest) {
  const gate = await aiGate();
  if (!gate.ok) return gate.res;

  let body: { productId?: string; lang?: string; platform?: string; shopUrl?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "error" }, { status: 400 }); }
  const lang = LANG_NAME[body.lang ?? ""] ? body.lang! : "fr";
  const platform = PLATFORM[body.platform ?? ""] ? body.platform! : "facebook";

  // RLS: the seller can only read their own product and shop
  const { data: p } = await gate.sb.from("products").select("name, description, price_dzd, category, shop_id").eq("id", body.productId ?? "").maybeSingle();
  if (!p) return NextResponse.json({ error: "err_not_found" }, { status: 404 });
  const { data: s } = await gate.sb.from("shops").select("name, slug, wilaya, delivery_home_dzd, delivery_desk_dzd").eq("id", p.shop_id).maybeSingle();
  if (!s) return NextResponse.json({ error: "err_not_found" }, { status: 404 });
  const link = String(body.shopUrl ?? "").startsWith("http") ? String(body.shopUrl).slice(0, 200) : `/s/${s.slug}`;

  try {
    const res = await gate.client.beta.messages.create({
      model: AI_MODEL,
      max_tokens: 2000,
      betas: AI_BETAS,
      fallbacks: "default",
      system: `${BLEDIFY_CONTEXT}\n\nYou write social media posts that help home-based sellers get orders. Output only the post text, ready to paste, nothing else.`,
      output_config: { effort: "low" },
      messages: [{
        role: "user",
        content: `Write ${PLATFORM[platform]} in ${LANG_NAME[lang]}.
Product: ${p.name}
Description: ${p.description || "(none)"}
Price: ${formatDZD(p.price_dzd)}
Shop: ${s.name} (${s.wilaya || "Algeria"})
Delivery: stop-desk ${formatDZD(s.delivery_desk_dzd)}, home ${formatDZD(s.delivery_home_dzd)}, cash on delivery, all 58 wilayas.
Order link: ${link}
Mention that it is homemade, the price, cash on delivery, and end with the order link on its own line. Don't invent facts beyond the description.`,
      }],
    });
    if (res.stop_reason === "refusal") return NextResponse.json({ error: "ai_refused" }, { status: 422 });
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
    return NextResponse.json({ text });
  } catch (e) {
    return aiErrorResponse(e);
  }
}
