"use client";
import type { DictKey } from "@/lib/i18n/dict";

/** POST to an /api/ai route; returns data or an i18n error key. */
export async function aiPost<T>(path: string, body: unknown): Promise<{ data?: T; error?: DictKey }> {
  try {
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { error: (json.error as DictKey) || "error" };
    return { data: json as T };
  } catch {
    return { error: "error" };
  }
}
