import "server-only";
import { cookies } from "next/headers";
import { translate, type DictKey, type Lang } from "./dict";

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get("lang")?.value;
  return v === "ar" ? "ar" : "fr";
}

export async function getT() {
  const lang = await getLang();
  return { lang, t: (k: DictKey, vars?: Record<string, string | number>) => translate(lang, k, vars) };
}
