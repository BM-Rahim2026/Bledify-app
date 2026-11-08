import { NextResponse, type NextRequest } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AI_BETAS, AI_MODEL, BLEDIFY_CONTEXT, LANG_NAME, aiErrorResponse, aiGate, allowedImage } from "@/lib/server/ai";
import { CATEGORIES } from "@/lib/categories";

const Listing = z.object({
  name: z.string().describe("Short product title, max 70 characters, includes quantity/size when relevant"),
  description: z.string().describe("2-4 short sentences: what it is, how it is made at home, ingredients/materials, size or quantity, how to order or keep it"),
  story: z.string().describe("2-3 warm sentences telling the product's story: who makes it, where in Algeria, how, and what makes it special. Only use facts the seller gave or that are visible; otherwise keep it general and true."),
  category: z.enum(CATEGORIES),
  price_min_dzd: z.number().int(),
  price_max_dzd: z.number().int(),
  price_note: z.string().describe("One sentence explaining the suggested price range"),
  tips: z.array(z.string()).describe("Up to 3 short, practical tips to sell this product better (photos, presentation, delivery)"),
});

// Writes a product listing from the seller's photos and notes.
export async function POST(req: NextRequest) {
  const gate = await aiGate();
  if (!gate.ok) return gate.res;

  let body: { name?: string; notes?: string; images?: string[]; lang?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "error" }, { status: 400 }); }
  const lang = body.lang === "ar" ? "ar" : "fr";
  const images = (body.images ?? []).filter(allowedImage).slice(0, 3);
  const name = String(body.name ?? "").slice(0, 120);
  const notes = String(body.notes ?? "").slice(0, 600);
  if (!images.length && !name.trim() && !notes.trim()) return NextResponse.json({ error: "ai_need_input" }, { status: 422 });

  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    ...images.map((url) => ({ type: "image" as const, source: { type: "url" as const, url } })),
    {
      type: "text",
      text: `Write a product listing for this seller's shop.
Seller's product name (may be empty): ${name || "(none)"}
Seller's notes (may be empty): ${notes || "(none)"}

Write "name", "description" and "story" in ${LANG_NAME[lang]}. Categories: food (cakes, home cooking), fashion (clothing, couture, jewellery), crafts (pottery, copper, embroidery, handmade objects), home (rugs, decor, household textiles), terroir (olive oil, honey, dates, cheese, spices), occasions (bridal trousseau, henna trays, wedding favours, gifts), beauty (homemade natural cosmetics: soaps, liquid hand soap, oils, rose water, henna powder, clay and ghassoul masks, hair and skin care). Keep the seller's own words and facts; do not invent ingredients, sizes or claims you cannot see or read. Warm, simple, trustworthy tone for Algerian buyers; no emojis in the name, at most one in the description. Suggest a realistic retail price range in DA for this kind of homemade product in Algeria in 2026. Write "price_note" and "tips" in ${LANG_NAME[lang]} too.`,
    },
  ];

  try {
    const res = await gate.client.beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 4000,
      betas: AI_BETAS,
      fallbacks: "default",
      system: `${BLEDIFY_CONTEXT}\n\nYou help sellers write clear, honest product listings.`,
      output_config: { effort: "low", format: betaZodOutputFormat(Listing) },
      messages: [{ role: "user", content }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) return NextResponse.json({ error: "ai_refused" }, { status: 422 });
    return NextResponse.json(res.parsed_output);
  } catch (e) {
    return aiErrorResponse(e);
  }
}
