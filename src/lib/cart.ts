"use client";
// Per-shop cart kept in the browser so it survives the login step.
export type Cart = Record<string, number>;
const key = (slug: string) => `bledify:cart:${slug}`;

export function readCart(slug: string): Cart {
  try { return JSON.parse(localStorage.getItem(key(slug)) || "{}") as Cart; } catch { return {}; }
}
export function writeCart(slug: string, cart: Cart) {
  try {
    const clean = Object.fromEntries(Object.entries(cart).filter(([, n]) => n > 0));
    if (Object.keys(clean).length) localStorage.setItem(key(slug), JSON.stringify(clean));
    else localStorage.removeItem(key(slug));
  } catch { /* storage unavailable */ }
}
export function addToCart(slug: string, productId: string, n = 1) {
  const c = readCart(slug);
  c[productId] = Math.min(99, (c[productId] ?? 0) + n);
  writeCart(slug, c);
}
