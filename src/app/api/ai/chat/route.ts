import { NextResponse, type NextRequest } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { AI_BETAS, AI_MODEL, BLEDIFY_CONTEXT, aiErrorResponse, aiGate } from "@/lib/server/ai";
import { formatDZD } from "@/lib/format";

export const maxDuration = 60;

const SYSTEM = `${BLEDIFY_CONTEXT}

You are "l'assistante Bledify", a friendly, practical business coach for these sellers. Many are mothers selling from home for the first time, with little time and a phone as their only tool.
- Reply in the language the seller writes in (French, Arabic, or Algerian Darija in Arabic or Latin letters).
- Be concrete and short: a few sentences or a short list. Use simple words. Give real numbers in DA when talking about prices or costs.
- Help with: pricing (ingredients + time + packaging + margin), product photos with a phone, writing posts, replying to customers (including polite answers to "c'est trop cher"), confirming orders to avoid fake ones, handling refused parcels, delivery options, hygiene and food safety at home, organising busy periods like Ramadan and Aïd, and growing the shop.
- When asked to write a message to a customer, write it ready to copy.
- For legal, tax or health questions, give general guidance and suggest checking with the local Chambre de l'Artisanat et des Métiers (CAM) or a professional.
- Never invent facts about the seller's shop beyond the shop details given below.`;

type Turn = { role: "user" | "assistant"; content: string };

// Streams the assistant's answer as plain text.
export async function POST(req: NextRequest) {
  const gate = await aiGate();
  if (!gate.ok) return gate.res;

  let body: { messages?: Turn[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "error" }, { status: 400 }); }
  const turns = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  while (turns.length && turns[0].role !== "user") turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== "user") return NextResponse.json({ error: "error" }, { status: 400 });

  // the seller's own shop, products and stats (RLS-scoped)
  const [{ data: shop }, { data: products }, { data: stats }] = await Promise.all([
    gate.sb.from("shops").select("name, wilaya, description, delivery_home_dzd, delivery_desk_dzd").maybeSingle(),
    gate.sb.from("products").select("name, price_dzd, category, active").limit(40),
    gate.sb.rpc("seller_stats"),
  ]);
  const shopInfo = shop
    ? `Shop: ${shop.name} (${shop.wilaya || "wilaya not set"}). ${shop.description || ""}
Delivery fees: home ${formatDZD(shop.delivery_home_dzd)}, stop-desk ${formatDZD(shop.delivery_desk_dzd)}.
Products: ${(products ?? []).map((p) => `${p.name} – ${formatDZD(p.price_dzd)}${p.active ? "" : " (hidden)"}`).join("; ") || "none yet"}.
Orders: ${stats ? `${stats.total} total, ${stats.delivered} delivered, ${stats.returned} returned, ${stats.cancelled} cancelled, revenue ${formatDZD(stats.revenue_dzd)}` : "no data"}.`
    : "The seller has not created a shop yet.";

  try {
    const stream = gate.client.beta.messages.stream({
      model: AI_MODEL,
      max_tokens: 8000,
      betas: AI_BETAS,
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
        { type: "text", text: `About this seller:\n${shopInfo}` },
      ],
      messages: turns as Anthropic.Beta.BetaMessageParam[],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          const final = await stream.finalMessage();
          if (final.stop_reason === "refusal") controller.enqueue(encoder.encode("\n\n⚠️"));
        } catch (e) {
          console.error("[ai/chat] stream error", e);
          controller.enqueue(encoder.encode("\n\n⚠️"));
        } finally {
          controller.close();
        }
      },
      cancel() { stream.abort(); },
    });
    return new Response(readable, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  } catch (e) {
    return aiErrorResponse(e);
  }
}
