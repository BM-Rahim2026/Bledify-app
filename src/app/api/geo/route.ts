import { NextResponse } from "next/server";
import { ipWilaya } from "@/lib/server/location";

export const dynamic = "force-dynamic";

/** First guess of the visitor's wilaya from their connection (null outside Algeria). */
export async function GET() {
  return NextResponse.json({ code: await ipWilaya() }, { headers: { "cache-control": "private, no-store" } });
}
